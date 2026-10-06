"""
QURE Lab offline precompute.

Runs once, offline. Writes everything the website and the VR mode read:
  web/public/data/index.json
  web/public/data/patients/<sample_id>.json
  web/public/data/volumes/<sample_id>.bin     (uint8, 28*28*28, index = (x*28+y)*28+z)
  web/public/data/metrics.json
  web/public/data/qec.json

Nothing here runs at web runtime. Every number the VR mode displays comes from these files.

    python build.py
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, f1_score, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from qiskit import QuantumCircuit
from qiskit.quantum_info import DensityMatrix, Pauli, Statevector
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error, pauli_error

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "web" / "public" / "data"
SEED = 7
N_QUBITS = 4

# ---- noise model (documented in README) ---------------------------------------------------
NOISE_P2 = [0.0, 0.01, 0.02, 0.04, 0.08]  # two-qubit (CZ) depolarizing probability, five saved levels
P1_RATIO = 0.1                           # single-qubit depolarizing probability = P1_RATIO * p2
READOUT_RATIO = 1.0                      # symmetric readout flip probability    = READOUT_RATIO * p2
ZNE_SCALES = [1, 3]                      # gate-folding scale factors; largest = circuit-cost factor

# ---- trust rule (assumption, see README) --------------------------------------------------
TRUST_MARGIN = 0.10   # |p - 0.5| >= this  -> confident
REFER_MARGIN = 0.03   # |p - 0.5| <  this  -> no usable margin
TRUST_RULE = (
    "refer if the 0.5-thresholded label differs from the ideal label or |p-0.5| < %.2f; "
    "trust if |p-0.5| >= %.2f; otherwise caution" % (REFER_MARGIN, TRUST_MARGIN)
)


def trust_of(p, p_ideal):
    if (p >= 0.5) != (p_ideal >= 0.5) or abs(p - 0.5) < REFER_MARGIN:
        return "refer"
    return "trust" if abs(p - 0.5) >= TRUST_MARGIN else "caution"


# ---- data ---------------------------------------------------------------------------------
def load_data():
    from medmnist import NoduleMNIST3D

    (ROOT / "data").mkdir(exist_ok=True)
    tr = NoduleMNIST3D(split="train", download=True, size=28, root=str(ROOT / "data"))
    te = NoduleMNIST3D(split="test", download=True, size=28, root=str(ROOT / "data"))
    sq = lambda a: np.asarray(a).reshape(-1, 28, 28, 28).astype(np.uint8)
    return sq(tr.imgs), tr.labels.ravel().astype(int), sq(te.imgs), te.labels.ravel().astype(int)


# ---- circuit ------------------------------------------------------------------------------
def ring(qc):
    for i in range(N_QUBITS):
        qc.cz(i, (i + 1) % N_QUBITS)


def build_circuit(x, th):
    """H, RZ(x_i) encoding; CZ ring; RY(th1); CZ ring; RY(th2). Output observable: <Z> on qubit 0."""
    qc = QuantumCircuit(N_QUBITS)
    for i in range(N_QUBITS):
        qc.h(i)
        qc.rz(float(x[i]), i)
    ring(qc)
    for i in range(N_QUBITS):
        qc.ry(float(th[i]), i)
    ring(qc)
    for i in range(N_QUBITS):
        qc.ry(float(th[N_QUBITS + i]), i)
    return qc


def np_expz(X, th):
    """Vectorised noiseless simulator used ONLY for training. Verified against Qiskit below."""
    n = X.shape[0]
    s = np.zeros((n, 2, 2, 2, 2), dtype=complex)
    s[:, 0, 0, 0, 0] = 1

    def one(s, q, U):  # U: (n,2,2) or (2,2)
        ax = q + 1
        s = np.moveaxis(s, ax, -1)
        s = np.einsum("nabcj,nij->nabci", s, U) if U.ndim == 3 else np.einsum("nabcj,ij->nabci", s, U)
        return np.moveaxis(s, -1, ax)

    Hm = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
    for q in range(N_QUBITS):
        s = one(s, q, Hm)
        a = X[:, q]
        Rz = np.zeros((n, 2, 2), dtype=complex)
        Rz[:, 0, 0] = np.exp(-0.5j * a)
        Rz[:, 1, 1] = np.exp(0.5j * a)
        s = one(s, q, Rz)

    def cz_ring(s):
        for i in range(N_QUBITS):
            j = (i + 1) % N_QUBITS
            idx = [slice(None)] * 5
            idx[i + 1] = 1
            idx[j + 1] = 1
            s = s.copy()
            s[tuple(idx)] *= -1
        return s

    def ry(t):
        c, sn = np.cos(t / 2), np.sin(t / 2)
        return np.array([[c, -sn], [sn, c]], dtype=complex)

    s = cz_ring(s)
    for q in range(N_QUBITS):
        s = one(s, q, ry(th[q]))
    s = cz_ring(s)
    for q in range(N_QUBITS):
        s = one(s, q, ry(th[N_QUBITS + q]))
    pr = np.abs(s) ** 2
    return pr[:, 0].sum(axis=(1, 2, 3)) - pr[:, 1].sum(axis=(1, 2, 3))


def train_quantum(Xa, y):
    w = np.where(y == 1, 0.5 / max(y.mean(), 1e-9), 0.5 / max(1 - y.mean(), 1e-9))

    def loss(th):
        p = np.clip((1 - np_expz(Xa, th)) / 2, 1e-6, 1 - 1e-6)
        return float(np.mean(w * -(y * np.log(p) + (1 - y) * np.log(1 - p))))

    rng = np.random.default_rng(SEED)
    best = None
    for _ in range(6):
        r = minimize(loss, rng.uniform(-np.pi, np.pi, 2 * N_QUBITS), method="L-BFGS-B")
        if best is None or r.fun < best.fun:
            best = r
    return best.x, best.fun


# ---- noisy simulation ---------------------------------------------------------------------
PAULI = {
    (q, a): Pauli("I" * (N_QUBITS - 1 - q) + a + "I" * q).to_matrix() for q in range(N_QUBITS) for a in "XYZ"
}


def bloch_of(rho):
    return [[float(np.real(np.trace(rho @ PAULI[(q, a)]))) for a in "XYZ"] for q in range(N_QUBITS)]


def noise_model(p2):
    nm = NoiseModel(basis_gates=["h", "rz", "ry", "cz", "id", "save_density_matrix"])
    if p2 > 0:
        nm.add_all_qubit_quantum_error(depolarizing_error(p2 * 16 / 15, 2), ["cz"])  # prob p2 of a random Pauli
        e1 = depolarizing_error(P1_RATIO * p2 * 4 / 3, 1)
        nm.add_all_qubit_quantum_error(e1, ["h", "rz", "ry"])
    return nm


def run_dm(circs, p2):
    be = AerSimulator(method="density_matrix", noise_model=noise_model(p2))
    cs = []
    for c in circs:
        c = c.copy()
        c.save_density_matrix()
        cs.append(c)
    res = be.run(cs, shots=1).result()
    return [np.array(res.data(i)["density_matrix"]) for i in range(len(cs))]


def fold(qc, s):
    out = qc.copy()
    for _ in range((s - 1) // 2):
        out = out.compose(qc.inverse()).compose(qc)
    return out


def clip_norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1 else v


def simulate_all(X, th):
    """Returns per-sample dict of ideal/noisy/mitigated for every noise level."""
    circs = [build_circuit(x, th) for x in X]
    ideal_dm = [np.array(DensityMatrix(Statevector(c)).data) for c in circs]
    ideal_bloch = [bloch_of(r) for r in ideal_dm]
    ideal_z = [b[0][2] for b in ideal_bloch]
    out = [dict(ideal_bloch=ideal_bloch[i], ideal_z=ideal_z[i], levels=[]) for i in range(len(X))]
    for p2 in NOISE_P2:
        print("  noise p2 =", p2, flush=True)
        r = READOUT_RATIO * p2
        folded = {s: run_dm([fold(c, s) for c in circs], p2) for s in ZNE_SCALES}
        for i in range(len(X)):
            b = {s: np.array(bloch_of(folded[s][i])) for s in ZNE_SCALES}  # (4,3)
            z1 = b[1][0][2]
            noisy_meas = (1 - 2 * r) * z1                 # what a noisy readout reports
            readout = noisy_meas / (1 - 2 * r)            # readout correction (calibrated confusion matrix)
            s1, s3 = ZNE_SCALES
            zne = readout + (readout - b[s3][0][2]) * (s1 / (s3 - s1))  # linear extrapolation to scale 0
            zne = float(np.clip(zne, -1, 1))
            mit_b = b[1] + (b[1] - b[3]) * (1 / 2)
            mit_b = np.array([clip_norm(v) for v in mit_b])
            out[i]["levels"].append(
                dict(noisy_bloch=b[1].tolist(), mit_bloch=mit_b.tolist(),
                     z_noisy=float(noisy_meas), z_readout=float(readout), z_zne=zne)
            )
    return out


# ---- QEC ----------------------------------------------------------------------------------
QEC_P = [0.02, 0.10, 0.25, 0.50, 0.65]
QEC_EVENTS_PER_P = 4


def qec_fidelity(code, p):
    """Logical fidelity of logical |0> (|000> for the bit-flip code under X noise, |+++> for the
    phase-flip code under Z noise). 'none' = a single unprotected qubit |0> under X noise."""
    from qiskit.quantum_info import partial_trace

    n = 1 if code == "none" else 3
    qc = QuantumCircuit(n)
    if code != "none":
        qc.cx(0, 1)
        qc.cx(0, 2)
        if code == "phase":
            for i in range(3):
                qc.h(i)
    qc.barrier()
    for i in range(n):
        qc.id(i)            # error slot
    qc.barrier()
    if code != "none":
        if code == "phase":
            for i in range(3):
                qc.h(i)
        qc.cx(0, 1)
        qc.cx(0, 2)
        qc.ccx(1, 2, 0)     # coherent majority-vote correction
    err = pauli_error([("Z" if code == "phase" else "X", p), ("I", 1 - p)])
    nm = NoiseModel(basis_gates=["id", "h", "cx", "ccx", "save_density_matrix"])
    nm.add_all_qubit_quantum_error(err, ["id"])
    qc.save_density_matrix()
    r = np.array(AerSimulator(method="density_matrix", noise_model=nm).run(qc, shots=1).result().data(0)["density_matrix"])
    red = partial_trace(DensityMatrix(r), list(range(1, n))).data if n > 1 else r
    ref = Statevector.from_label("0").data
    return float(np.real(ref.conj() @ red @ ref))


def build_qec(rng):
    rows = []
    for p in QEC_P:
        rows.append(dict(
            p=p,
            unprotected=qec_fidelity("none", p),
            bitflip_code=qec_fidelity("bit", p),
            phaseflip_code=qec_fidelity("phase", p),
        ))
    events = []
    for p in QEC_P:
        k = 0
        while k < QEC_EVENTS_PER_P:
            flips = (rng.random(3) < p).astype(int)
            if flips.sum() == 0:      # conditioned on >=1 physical error so each replay shows a decode step
                continue
            s1, s2 = int(flips[0] ^ flips[1]), int(flips[1] ^ flips[2])
            fix = {(1, 0): 0, (1, 1): 1, (0, 1): 2}.get((s1, s2))
            residual = flips.copy()
            if fix is not None:
                residual[fix] ^= 1
            events.append(dict(p=p, flips=flips.tolist(), syndrome=[s1, s2], corrected_qubit=fix,
                               logical_error=bool(residual.sum() >= 2 or (residual.sum() == 3))))
            k += 1
    # logical error of a repetition code after correction: decoded value flipped iff majority flipped
    for e in events:
        e["logical_error"] = bool(sum(e["flips"]) >= 2)
    return dict(
        note=("3-qubit repetition codes under independent X (bit-flip code) or Z (phase-flip code) noise of "
              "probability p per data qubit, majority-vote decode. Fidelity is for the basis state each code "
              "protects (|0> and |+>). Events are sampled with a fixed seed, conditioned on at least one "
              "physical flip. These codes protect against one error type only; this demo does not repair a scan."),
        break_even_p=0.5,
        p_levels=QEC_P,
        rows=rows,
        events=events,
    )


# ---- main ---------------------------------------------------------------------------------
def metrics_for(y, p):
    pred = (np.asarray(p) >= 0.5).astype(int)
    return dict(
        accuracy=float(accuracy_score(y, pred)),
        f1=float(f1_score(y, pred, zero_division=0)),
        auc=float(roc_auc_score(y, p)),
        brier=float(brier_score_loss(y, p)),
    )


def main():
    rng = np.random.default_rng(SEED)
    Xtr_v, ytr, Xte_v, yte = load_data()
    print("train", Xtr_v.shape, ytr.mean(), "test", Xte_v.shape, yte.mean())
    pca = PCA(n_components=N_QUBITS, random_state=SEED).fit(Xtr_v.reshape(len(Xtr_v), -1) / 255.0)
    tr_c = pca.transform(Xtr_v.reshape(len(Xtr_v), -1) / 255.0)
    te_c = pca.transform(Xte_v.reshape(len(Xte_v), -1) / 255.0)
    sc = StandardScaler().fit(tr_c)
    ang = lambda c: np.pi / 2 + (np.pi / 2) * np.tanh(sc.transform(c) / 2)
    Atr, Ate = ang(tr_c), ang(te_c)

    Ztr, Zte = sc.transform(tr_c), sc.transform(te_c)
    lr = LogisticRegression(class_weight="balanced", max_iter=1000).fit(Ztr, ytr)
    svm = SVC(probability=True, class_weight="balanced", random_state=SEED).fit(Ztr, ytr)
    p_lr, p_svm = lr.predict_proba(Zte)[:, 1], svm.predict_proba(Zte)[:, 1]

    print("training quantum classifier ...")
    th, fun = train_quantum(Atr, ytr)
    print("  loss", fun, "theta", np.round(th, 3))

    # cross-check numpy trainer against Qiskit statevector
    chk = [Statevector(build_circuit(Ate[i], th)) for i in range(3)]
    chk_z = [float(np.real(s.expectation_value(Pauli("IIIZ")))) for s in chk]
    assert np.allclose(chk_z, np_expz(Ate[:3], th), atol=1e-9), "trainer/Qiskit mismatch"

    print("simulating test set in Qiskit Aer ...")
    sims = simulate_all(Ate, th)
    pz = lambda z: float(np.clip((1 - z) / 2, 0, 1))

    # ---- metrics.json
    metrics = dict(
        n_test=int(len(yte)),
        noise_p2=NOISE_P2,
        note="Computed on the full NoduleMNIST3D test split (28^3). Quantum p_malignant = (1 - <Z0>)/2.",
        classical=dict(logreg=metrics_for(yte, p_lr), svm=metrics_for(yte, p_svm)),
        quantum=[],
    )
    for li, p2 in enumerate(NOISE_P2):
        zs = lambda k: np.array([pz(s["levels"][li][k]) for s in sims])
        metrics["quantum"].append(dict(
            noise_p2=p2,
            ideal=metrics_for(yte, np.array([pz(s["ideal_z"]) for s in sims])),
            noisy=metrics_for(yte, zs("z_noisy")),
            readout=metrics_for(yte, zs("z_readout")),
            mitigated=metrics_for(yte, zs("z_zne")),
        ))
    # ---- choose demo patients
    p_ideal = np.array([pz(s["ideal_z"]) for s in sims])
    top = len(NOISE_P2) - 1
    p_top = np.array([pz(s["levels"][top]["z_noisy"]) for s in sims])
    p_mit_top = np.array([pz(s["levels"][top]["z_zne"]) for s in sims])
    margin = np.abs(p_ideal - 0.5)
    ok = (p_ideal >= 0.5) == (yte == 1)
    flips = ((p_top >= 0.5) != (p_ideal >= 0.5)) | (np.abs(p_top - 0.5) < REFER_MARGIN)
    chosen = []
    def pick(mask, k):
        idx = [i for i in np.argsort(-margin) if mask[i] and i not in chosen][:k]
        chosen.extend(idx)
    pick(ok & (yte == 1), 2)
    pick(ok & (yte == 0), 2)
    pick(ok & flips & ~np.isin(np.arange(len(yte)), chosen), 1)
    pick(~ok, 1)
    pick(ok, 6 - len(chosen))
    chosen = [int(i) for i in chosen[:6]]
    print("patients", chosen)

    for sub in ("patients", "volumes"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    index = []
    for i in chosen:
        sid = "nodule_%04d" % i
        (OUT / "volumes" / (sid + ".bin")).write_bytes(Xte_v[i].astype(np.uint8).tobytes())
        s = sims[i]
        runs = []
        for li, p2 in enumerate(NOISE_P2):
            L = s["levels"][li]
            pn, pm = pz(L["z_noisy"]), pz(L["z_zne"])
            runs.append(dict(
                noise_p2=p2,
                expZ=dict(ideal=s["ideal_z"], noisy=L["z_noisy"], readout=L["z_readout"], zne=L["z_zne"]),
                p_malignant=dict(ideal=float(p_ideal[i]), noisy=pn, mitigated=pm),
                bloch=dict(ideal=s["ideal_bloch"], noisy=L["noisy_bloch"], mitigated=L["mit_bloch"]),
                trust=trust_of(pn, p_ideal[i]),
                trust_mitigated=trust_of(pm, p_ideal[i]),
            ))
        doc = dict(
            sample_id=sid,
            true_label=int(yte[i]),
            volume="volumes/%s.bin" % sid,
            pca=[float(v) for v in te_c[i]],
            angles=[float(v) for v in Ate[i]],
            classical=dict(logreg_p=float(p_lr[i]), svm_p=float(p_svm[i])),
            runs=runs,
        )
        (OUT / "patients" / (sid + ".json")).write_text(json.dumps(doc, indent=1))
        index.append(sid)

    (OUT / "index.json").write_text(json.dumps(dict(
        patients=index,
        noise_p2=NOISE_P2,
        readout_error=[READOUT_RATIO * p for p in NOISE_P2],
        zne_scales=ZNE_SCALES,
        circuit_cost_x=max(ZNE_SCALES),
        trust_rule=TRUST_RULE,
        model=dict(qubits=N_QUBITS, observable="Z on qubit 0", p_malignant="(1 - expZ) / 2",
                   theta=[float(t) for t in th]),
    ), indent=1))
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=1))
    (OUT / "qec.json").write_text(json.dumps(build_qec(rng), indent=1))
    print("done ->", OUT)


if __name__ == "__main__":
    main()
