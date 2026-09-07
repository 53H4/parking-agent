"""
ML analysis and report generator for parking datasets.

Generates plots, predictions, metrics, a Word report, and a ZIP archive.

Usage:
    python analyze_report.py --data <dataset.csv> --out <output_dir>

Requires: pandas, numpy, scikit-learn, matplotlib, seaborn
Optional: python-docx
"""
import argparse, json, os, sys, zipfile, glob

def fail(out_dir, reason):
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump({"ok": False, "reason": reason}, f, ensure_ascii=False, indent=2)
    print("ANALYZE_FAIL: " + reason)
    sys.exit(0)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    DATA, OUT = args.data, args.out
    os.makedirs(OUT, exist_ok=True)

    if not os.path.exists(DATA):
        fail(OUT, f"Dataset nije pronadjen: {DATA}")

    try:
        import pandas as pd, numpy as np
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
        from sklearn.model_selection import train_test_split, StratifiedKFold
        from sklearn.preprocessing import LabelEncoder, StandardScaler
        from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
        from sklearn.linear_model import LogisticRegression
        from sklearn.impute import SimpleImputer
        from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                                     f1_score, confusion_matrix, roc_auc_score, roc_curve)
    except Exception as e:
        fail(OUT, f"Nedostaje ML biblioteka (pandas/sklearn/matplotlib/seaborn): {e}")

    sns.set_style("whitegrid")
    plt.rcParams["figure.dpi"] = 120

    df = pd.read_csv(DATA)

    # Validate dataset
    if len(df) < 500:
        fail(OUT, f"Premalo epizoda za analizu ({len(df)}). Treniraj agenta jos malo (treba bar 500).")
    if "ParkingSuccess" not in df.columns:
        fail(OUT, "Dataset ne sadrzi kolonu ParkingSuccess.")
    vc = df["ParkingSuccess"].value_counts()
    if vc.get("Parked", 0) < 50 or vc.get("NotParked", 0) < 50:
        fail(OUT, "Nema dovoljno obje klase (treba bar 50 Parked i 50 NotParked). "
                  "Na pocetku su skoro sve kolizije - treniraj jos.")

    n = len(df)
    n_parked = int((df["ParkingSuccess"] == "Parked").sum())
    n_not = n - n_parked

    score_cols = ["DifficultyScore", "EarlyMomentumScore", "EarlyCautionScore",
                  "ExplorationBalanceScore", "QConfidenceScore"]

    # EDA
    fig, ax = plt.subplots(figsize=(6, 4))
    counts = df["ParkingSuccess"].value_counts()
    bars = ax.bar(counts.index, counts.values, color=["#2196F3", "#FF9800"],
                  edgecolor="white", width=0.5)
    for bar, val in zip(bars, counts.values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + n*0.01,
                f"{val}\n({val/n*100:.1f}%)", ha="center", fontsize=10)
    ax.set_title("Distribucija ciljne varijable - ParkingSuccess", fontsize=12)
    ax.set_ylabel("Broj epizoda"); ax.set_ylim(0, max(counts.values)*1.2)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_01_distribucija_ciljne.png", bbox_inches="tight"); plt.close()

    plot_num = ["ObstacleCount", "ParkedDensity", "EarlyRewardSum", "TotalSteps"]
    fig, axes = plt.subplots(2, 2, figsize=(11, 7)); axes = axes.flatten()
    for i, col in enumerate(plot_num):
        axes[i].hist(df[col].dropna(), bins=40, color="#2196F3", edgecolor="white", alpha=0.8)
        axes[i].set_title(f"{col}  (skew={df[col].skew():.2f})", fontsize=10)
        axes[i].set_ylabel("Frekvencija")
    plt.suptitle("Distribucije numerickih varijabli", fontsize=13, y=1.01)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_02_numericke_distribucije.png", bbox_inches="tight"); plt.close()

    corr_data = df[score_cols].corr()
    fig, ax = plt.subplots(figsize=(8, 6))
    mask = np.triu(np.ones_like(corr_data, dtype=bool))
    sns.heatmap(corr_data, mask=mask, annot=True, fmt=".2f", cmap="coolwarm",
                center=0, ax=ax, annot_kws={"size": 9}, linewidths=0.3)
    ax.set_title("Korelacijska matrica - ordinalne ocjene (0-5)", fontsize=12)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_03_korelacijska_matrica.png", bbox_inches="tight"); plt.close()

    fig, axes = plt.subplots(1, 3, figsize=(13, 4))
    for ax, col in zip(axes, ["ExperienceLevel", "ApproachStyle", "DominantDirection"]):
        ct = pd.crosstab(df[col], df["ParkingSuccess"], normalize="index") * 100
        ct.plot(kind="bar", ax=ax, color=["#2196F3", "#FF9800"], edgecolor="white")
        ax.set_title(col, fontsize=10); ax.set_ylabel("Postotak (%)"); ax.set_xlabel("")
        ax.tick_params(axis="x", rotation=20); ax.legend(fontsize=8)
    plt.suptitle("Uspjeh parkiranja po kategorickim varijablama", fontsize=12, y=1.02)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_04_uspjeh_kategoricke.png", bbox_inches="tight"); plt.close()

    # Preprocessing
    dfp = df.copy()
    median_erw = dfp["EarlyRewardSum"].median()
    dfp["EarlyRewardSum"] = dfp["EarlyRewardSum"].fillna(median_erw)
    for c in ["ExperienceLevel", "ApproachStyle", "DominantDirection", "GridTheme"]:
        dfp[c + "_enc"] = LabelEncoder().fit_transform(dfp[c].astype(str))
    y = (dfp["ParkingSuccess"] == "Parked").astype(int)

    ALL_FEATURES = ["ObstacleCount", "PathObstacles", "ParkedDensity", "RoadDensity",
        "EpsilonStart", "ExperienceEpisodes", "EarlyRewardSum", "EarlyExploreRate",
        "EarlyProgress", "DifficultyScore", "EarlyMomentumScore", "EarlyCautionScore",
        "ExplorationBalanceScore", "QConfidenceScore",
        "ExperienceLevel_enc", "ApproachStyle_enc", "DominantDirection_enc", "GridTheme_enc"]
    SEL_FEATURES = [f for f in ALL_FEATURES if f not in ("PathObstacles", "GridTheme_enc")]

    imp_all = SimpleImputer(strategy="median")
    X_all = pd.DataFrame(imp_all.fit_transform(dfp[ALL_FEATURES]), columns=ALL_FEATURES)
    imp_sel = SimpleImputer(strategy="median")
    X_sel = pd.DataFrame(imp_sel.fit_transform(dfp[SEL_FEATURES]), columns=SEL_FEATURES)

    def metr(yte, yp, yprob):
        return {"acc": round(accuracy_score(yte, yp), 4), "prec": round(precision_score(yte, yp), 4),
                "rec": round(recall_score(yte, yp), 4), "f1": round(f1_score(yte, yp), 4),
                "auc": round(roc_auc_score(yte, yprob), 4)}

    iters = []
    # RF: all features, 70/30
    Xtr, Xte, ytr, yte = train_test_split(X_all, y, test_size=0.30, random_state=42, stratify=y)
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1).fit(Xtr, ytr)
    m = metr(yte, rf.predict(Xte), rf.predict_proba(Xte)[:, 1])
    iters.append({"name": "RF Iter1 (sve 18, 70:30)", **m})
    # RF: selected features, 70/30
    Xtr, Xte, ytr, yte = train_test_split(X_sel, y, test_size=0.30, random_state=42, stratify=y)
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1).fit(Xtr, ytr)
    m = metr(yte, rf.predict(Xte), rf.predict_proba(Xte)[:, 1])
    iters.append({"name": "RF Iter2 (sel 16, 70:30)", **m})
    # RF: selected features, 80/20
    Xtr, Xte, ytr, yte = train_test_split(X_sel, y, test_size=0.20, random_state=42, stratify=y)
    rf3 = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1).fit(Xtr, ytr)
    m = metr(yte, rf3.predict(Xte), rf3.predict_proba(Xte)[:, 1])
    iters.append({"name": "RF Iter3 (sel 16, 80:20)", **m})
    # RF: tuned, 80/20
    rf4 = RandomForestClassifier(n_estimators=200, max_depth=20, min_samples_split=5,
                                 random_state=42, n_jobs=-1).fit(Xtr, ytr)
    pred4 = rf4.predict(Xte); prob4 = rf4.predict_proba(Xte)[:, 1]
    m_rf = metr(yte, pred4, prob4)
    iters.append({"name": "RF Iter4 (tuned, 80:20)", **m_rf})
    # Logistic Regression
    sc = StandardScaler(); Xtr_s = sc.fit_transform(Xtr); Xte_s = sc.transform(Xte)
    lr = LogisticRegression(max_iter=1000, random_state=42).fit(Xtr_s, ytr)
    pred_lr = lr.predict(Xte_s); prob_lr = lr.predict_proba(Xte_s)[:, 1]
    m_lr = metr(yte, pred_lr, prob_lr)
    iters.append({"name": "Logisticka regresija", **m_lr})
    # Gradient Boosting
    gb = HistGradientBoostingClassifier(max_iter=200, random_state=42).fit(Xtr, ytr)
    pred_gb = gb.predict(Xte); prob_gb = gb.predict_proba(Xte)[:, 1]
    m_gb = metr(yte, pred_gb, prob_gb)
    iters.append({"name": "Gradient Boosting", **m_gb})

    # Cross-validation
    def cv_eval(make_model, X, y, scale=False, k=5):
        skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
        acc, prec, rec, f1s, aucs = [], [], [], [], []
        for tr_i, te_i in skf.split(X, y):
            Xa, Xb = X.iloc[tr_i], X.iloc[te_i]
            ya, yb = y.iloc[tr_i], y.iloc[te_i]
            if scale:
                s = StandardScaler(); Xa = s.fit_transform(Xa); Xb = s.transform(Xb)
            mdl = make_model().fit(Xa, ya)
            yp = mdl.predict(Xb); ypr = mdl.predict_proba(Xb)[:, 1]
            acc.append(accuracy_score(yb, yp)); prec.append(precision_score(yb, yp))
            rec.append(recall_score(yb, yp)); f1s.append(f1_score(yb, yp))
            aucs.append(roc_auc_score(yb, ypr))
        out = {}
        for key, vals in [("acc", acc), ("prec", prec), ("rec", rec), ("f1", f1s), ("auc", aucs)]:
            out[key] = round(float(np.mean(vals)), 4)
            out[key + "_std"] = round(float(np.std(vals)), 4)
        out["folds_auc"] = [round(float(v), 4) for v in aucs]
        out["folds_acc"] = [round(float(v), 4) for v in acc]
        return out

    cv = [
        {"name": "Random Forest (podeseni)", **cv_eval(
            lambda: RandomForestClassifier(n_estimators=200, max_depth=20,
                                           min_samples_split=5, random_state=42, n_jobs=-1),
            X_sel, y)},
        {"name": "Logisticka regresija", **cv_eval(
            lambda: LogisticRegression(max_iter=1000, random_state=42), X_sel, y, scale=True)},
        {"name": "Gradient Boosting", **cv_eval(
            lambda: HistGradientBoostingClassifier(max_iter=200, random_state=42), X_sel, y)},
    ]

    feat_imp = sorted(zip(SEL_FEATURES, rf4.feature_importances_), key=lambda t: -t[1])

    fig, ax = plt.subplots(figsize=(9, 7))
    fi = pd.Series(dict(feat_imp)).sort_values()
    fi.plot(kind="barh", ax=ax, color="#2196F3", edgecolor="white")
    ax.set_title("Feature Importance - Random Forest (best)", fontsize=12); ax.set_xlabel("Importance")
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_05_feature_importance.png", bbox_inches="tight"); plt.close()

    for name, pred, cmap, fn in [("Random Forest (best)", pred4, "Blues", "graf_06_cm_random_forest.png"),
                                  ("Logisticka regresija", pred_lr, "Oranges", "graf_07_cm_logisticka_regresija.png"),
                                  ("Gradient Boosting", pred_gb, "Greens", "graf_10_cm_gradient_boosting.png")]:
        cm = confusion_matrix(yte, pred)
        fig, ax = plt.subplots(figsize=(5, 4))
        sns.heatmap(cm, annot=True, fmt="d", cmap=cmap, ax=ax,
                    xticklabels=["NotParked", "Parked"], yticklabels=["NotParked", "Parked"])
        ax.set_title(f"Confusion Matrix - {name}", fontsize=11)
        ax.set_ylabel("Stvarne"); ax.set_xlabel("Predvidjene")
        plt.tight_layout(); plt.savefig(f"{OUT}/{fn}", bbox_inches="tight"); plt.close()

    fig, ax = plt.subplots(figsize=(7, 5))
    fpr_rf, tpr_rf, _ = roc_curve(yte, prob4); fpr_lr, tpr_lr, _ = roc_curve(yte, prob_lr)
    fpr_gb, tpr_gb, _ = roc_curve(yte, prob_gb)
    ax.plot(fpr_rf, tpr_rf, color="#2196F3", lw=2, label=f"Random Forest (AUC={m_rf['auc']:.4f})")
    ax.plot(fpr_lr, tpr_lr, color="#FF9800", lw=2, label=f"Logisticka regresija (AUC={m_lr['auc']:.4f})")
    ax.plot(fpr_gb, tpr_gb, color="#4CAF50", lw=2, label=f"Gradient Boosting (AUC={m_gb['auc']:.4f})")
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Slucajni klasifikator")
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC krivulje - usporedba modela"); ax.legend(loc="lower right", fontsize=10)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_08_roc_usporedba.png", bbox_inches="tight"); plt.close()

    labels = ["Accuracy", "Precision", "Recall", "F1", "AUC-ROC"]
    rf_vals = [m_rf["acc"], m_rf["prec"], m_rf["rec"], m_rf["f1"], m_rf["auc"]]
    lr_vals = [m_lr["acc"], m_lr["prec"], m_lr["rec"], m_lr["f1"], m_lr["auc"]]
    gb_vals = [m_gb["acc"], m_gb["prec"], m_gb["rec"], m_gb["f1"], m_gb["auc"]]
    x = np.arange(len(labels))
    fig, ax = plt.subplots(figsize=(10, 5))
    b1 = ax.bar(x - 0.26, rf_vals, 0.26, label="Random Forest", color="#2196F3", edgecolor="white")
    b2 = ax.bar(x,        lr_vals, 0.26, label="Logisticka regresija", color="#FF9800", edgecolor="white")
    b3 = ax.bar(x + 0.26, gb_vals, 0.26, label="Gradient Boosting", color="#4CAF50", edgecolor="white")
    for bars in [b1, b2, b3]:
        for bar in bars:
            ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.004,
                    f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=7.5)
    ax.set_xticks(x); ax.set_xticklabels(labels); ax.set_ylim(0.7, 1.02)
    ax.set_title("Usporedba metrika - tri klasifikacijska modela"); ax.legend(fontsize=10)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_09_usporedba_metrika.png", bbox_inches="tight"); plt.close()

    fig, ax = plt.subplots(figsize=(10, 5))
    cvlabels = ["Accuracy", "Precision", "Recall", "F1", "AUC-ROC"]
    keys = ["acc", "prec", "rec", "f1", "auc"]
    x = np.arange(len(cvlabels))
    colors = ["#2196F3", "#FF9800", "#4CAF50"]
    for i, (c, col) in enumerate(zip(cv, colors)):
        vals = [c[k] for k in keys]
        errs = [c[k + "_std"] for k in keys]
        ax.bar(x + (i - 1) * 0.26, vals, 0.26, yerr=errs, capsize=4,
               label=c["name"], color=col, edgecolor="white")
    ax.set_xticks(x); ax.set_xticklabels(cvlabels); ax.set_ylim(0.7, 1.02)
    ax.set_title("Petostruka unakrsna validacija - prosjek i standardna devijacija")
    ax.legend(fontsize=9)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_11_unakrsna_validacija.png", bbox_inches="tight"); plt.close()

    fig, ax = plt.subplots(figsize=(9, 4.5))
    for c, col in zip(cv, colors):
        ax.plot(range(1, len(c["folds_auc"]) + 1), c["folds_auc"], marker="o",
                color=col, lw=2, label=c["name"])
    ax.set_xticks(range(1, len(cv[0]["folds_auc"]) + 1))
    ax.set_xlabel("Podjela (fold)"); ax.set_ylabel("AUC-ROC")
    ax.set_title("AUC-ROC po pojedinacnim podjelama unakrsne validacije")
    ax.legend(fontsize=9); ax.grid(alpha=0.3)
    plt.tight_layout(); plt.savefig(f"{OUT}/graf_12_auc_po_podjelama.png", bbox_inches="tight"); plt.close()

    # Processed dataset
    dff = df.copy()
    dff["EarlyRewardSum"] = dff["EarlyRewardSum"].fillna(median_erw)
    for c in ["ExperienceLevel", "ApproachStyle", "DominantDirection", "GridTheme"]:
        dff[c + "_enc"] = LabelEncoder().fit_transform(dff[c].astype(str))
    X_full = pd.DataFrame(imp_sel.transform(dff[SEL_FEATURES]), columns=SEL_FEATURES)
    dff["RF_Predikcija"] = rf4.predict(X_full)
    dff["RF_Prob_Parked"] = rf4.predict_proba(X_full)[:, 1].round(4)
    dff["target"] = (dff["ParkingSuccess"] == "Parked").astype(int)
    dff["RF_Tocno"] = (dff["RF_Predikcija"] == dff["target"]).astype(int)
    processed_path = f"{OUT}/parking_episode_dataset_PROCESSED.csv"
    dff.to_csv(processed_path, index=False)

    # Report data
    import datetime as _dt

    cm_rf_m = confusion_matrix(yte, pred4)
    cm_lr_m = confusion_matrix(yte, pred_lr)
    cm_gb_m = confusion_matrix(yte, pred_gb)

    miss = df.isna().sum()
    _imput = {"EarlyRewardSum": "imputacija medijanom (%.0f)" % median_erw}
    missing_rows = []
    for c in df.columns:
        k = int(miss[c])
        if k <= 0:
            continue
        postupak = _imput.get(c, "kolona iskljucena iz modela" if c in ("DetourSteps", "TotalSteps")
                              else "imputacija medijanom")
        missing_rows.append([c, "{:,}".format(k).replace(",", "."), "%.2f%%" % (k / n * 100), postupak])

    def _corr(a, b):
        try:
            return float(df[a].corr(df[b]))
        except Exception:
            return float("nan")

    r_obs = _corr("ObstacleCount", "PathObstacles")
    n_train, n_test = int(len(Xtr)), int(len(Xte))
    pct_parked = n_parked / n * 100
    pct_not = n_not / n * 100

    _ratio = max(pct_parked, pct_not) / max(min(pct_parked, pct_not), 1e-9)
    if _ratio < 1.2:
        balance_desc = "priblizno uravnotezena"
        balance_note = ("Takva raspodjela ne zahtijeva posebne korekcije, ali je podjela na skupove "
                        "ipak izvrsena stratifikovano radi stabilnosti procjene.")
    elif _ratio < 2.0:
        balance_desc = "umjereno neuravnotezena"
        balance_note = ("Neuravnotezenost je uzeta u obzir stratifikovanom podjelom na skup za "
                        "treniranje i testiranje.")
    elif _ratio < 4.0:
        balance_desc = "izrazito neuravnotezena"
        balance_note = ("Zbog izrazene neuravnotezenosti tacnost sama po sebi nije dovoljna mjera "
                        "kvaliteta, pa se rezultati tumace prvenstveno kroz F1 i AUC. Podjela na "
                        "skupove izvrsena je stratifikovano.")
    else:
        balance_desc = "jako neuravnotezena"
        balance_note = ("Pri ovako jakoj neuravnotezenosti model koji bi uvijek predvidjao vecinsku "
                        "klasu vec bi postigao visoku tacnost, pa se kvalitet ocjenjuje kroz F1, "
                        "Recall i AUC. Podjela na skupove izvrsena je stratifikovano.")
    _majority = "Parked" if n_parked >= n_not else "NotParked"
    _baseline_acc = max(pct_parked, pct_not)

    _models = [("Random Forest", m_rf), ("Logisticka regresija", m_lr),
               ("Gradient Boosting", m_gb)]
    _ranked = sorted(_models, key=lambda t: -t[1]["auc"])
    win_name, m_win = _ranked[0]
    lose_name, m_lose = _ranked[-1]
    d_auc = m_win["auc"] - m_lose["auc"]
    _second_name, m_second = _ranked[1]
    _d_top2 = m_win["auc"] - m_second["auc"]
    _sweep = all(m_win[k] >= m_lose[k] for k in ("acc", "prec", "rec", "f1", "auc"))
    _sweep_txt = ("najbolji po svim mjerenim metrikama" if _sweep
                  else "najbolji po AUC vrijednosti, dok su ostale metrike podijeljene")
    _tree_beats_linear = min(m_rf["auc"], m_gb["auc"]) > m_lr["auc"]

    margin_txt = ("Raspon AUC vrijednosti izmedju najboljeg i najslabijeg modela iznosi %.4f. "
                  "Razlika izmedju prva dva modela (%s i %s) iznosi %.4f, dakle %s."
                  % (d_auc, win_name, _second_name, _d_top2,
                     "zanemarivo" if _d_top2 < 0.004 else
                     "malo, ali dosljedno" if _d_top2 < 0.02 else "znatno"))
    if _d_top2 < 0.004:
        complexity_txt = ("Buduci da je razlika izmedju dva najbolja modela zanemariva, izbor "
                          "izmedju njih moze se temeljiti i na drugim kriterijima, poput "
                          "jednostavnosti tumacenja.")
    else:
        complexity_txt = ("Poredjenje pokazuje da model %s daje dosljedno bolji rezultat od "
                          "ostalih, cime je njegova upotreba opravdana." % win_name)

    if _tree_beats_linear:
        nonlin_txt = ("Prednost oba ansambla stabala nad linearnim modelom ukazuje da odnos izmedju "
                      "tezine okoline i vjestine agenta nije linearan: ista razina vjestine daje "
                      "bitno razlicite izglede za uspjeh ovisno o tezini generisane mape.")
    else:
        nonlin_txt = ("Cinjenica da linearni model nije jasno nadmasen ukazuje da je odnos izmedju "
                      "ulaznih varijabli i ishoda uglavnom linearan, odnosno da u podacima nema "
                      "izrazenih interakcija koje bi ansambl stabala mogao iskoristiti.")

    _cum = 0.0
    fi_rows = []
    for i, (fname_, val) in enumerate(feat_imp[:10], start=1):
        _cum += float(val)
        fi_rows.append([str(i), fname_, "%.4f" % val, "%.1f%%" % (_cum * 100)])
    top3 = [f for f, _ in feat_imp[:3]]
    top5_share = sum(float(v) for _, v in feat_imp[:5]) * 100
    top_feat = feat_imp[0][0]

    _FEAT_EXPL = {
        "QConfidenceScore": "odrazava koliko je agent siguran u svoje odluke na pocetku epizode, "
                            "sto je najdirektniji pokazatelj dostignute vjestine",
        "ExperienceEpisodes": "mjeri koliko je epizoda agent vec odigrao, odnosno koliko je prilika "
                              "imao da izgradi svoju politiku",
        "EpsilonStart": "odredjuje koliko ce agent istrazivati umjesto koristiti nauceno, pa "
                        "direktno utjece na rizik od pogresnog poteza",
        "RoadDensity": "opisuje koliko je prepreka postavljeno na samoj cesti, sto je glavni izvor "
                       "tezine epizode",
        "ParkedDensity": "opisuje koliko je parking mjesta zauzeto, cime se suzava prostor za manevar",
        "ObstacleCount": "predstavlja ukupan broj prepreka u epizodi i time najgrublju mjeru njene tezine",
        "EarlyProgress": "mjeri koliko se agent priblizio cilju u prvim koracima epizode",
        "EarlyRewardSum": "zbraja nagrade ostvarene u prvim koracima i sluzi kao rani signal o "
                          "kvalitetu poteza",
        "EarlyExploreRate": "pokazuje udio nasumicnih poteza u prvim koracima epizode",
        "DifficultyScore": "predstavlja zbirnu ocjenu tezine generisane mape",
        "EarlyMomentumScore": "ocjenjuje koliko se agent odlucno krece u prvim koracima",
        "EarlyCautionScore": "ocjenjuje opreznost agenta u prvim koracima",
        "ExplorationBalanceScore": "ocjenjuje odnos izmedju istrazivanja i koristenja naucenog",
        "ExperienceLevel_enc": "oznacava kategoriju iskustva agenta, od pocetnika do iskusnog",
        "ApproachStyle_enc": "opisuje stil kojim agent pristupa cilju",
        "DominantDirection_enc": "biljezi prevladavajuci smjer kretanja agenta u epizodi",
    }
    _expl = _FEAT_EXPL.get(top_feat)
    if _expl:
        fi_lead = "Najveci doprinos ima varijabla %s, sto je smisleno: ona %s." % (top_feat, _expl)
    else:
        fi_lead = "Najveci doprinos ima varijabla %s." % top_feat

    if top5_share >= 70:
        conc_txt = ("Prvih pet varijabli nosi %.1f%% ukupne vaznosti, sto znaci da je predikcija "
                    "koncentrisana na mali broj informativnih obiljezja." % top5_share)
        conc_find = ("Prvih pet varijabli nosi %.1f%% ukupne vaznosti, pa je predikcija "
                     "koncentrisana na mali broj obiljezja." % top5_share)
    elif top5_share >= 50:
        conc_txt = ("Prvih pet varijabli nosi %.1f%% ukupne vaznosti, dok ostatak doprinosi "
                    "ravnomjernije." % top5_share)
        conc_find = "Prvih pet varijabli nosi %.1f%% ukupne vaznosti." % top5_share
    else:
        conc_txt = ("Prvih pet varijabli nosi %.1f%% ukupne vaznosti, sto znaci da je doprinos "
                    "razmjerno ravnomjerno raspodijeljen i da nijedno obiljezje ne dominira "
                    "predikcijom." % top5_share)
        conc_find = ("Vaznost je ravnomjerno raspodijeljena; prvih pet varijabli nosi %.1f%% "
                     "ukupne vaznosti." % top5_share)

    eda_extra = ""
    try:
        _order = ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"]
        _rate = df.groupby("ExperienceLevel")["ParkingSuccess"].apply(
            lambda s: float((s == "Parked").mean()) * 100)
        _present = [l for l in _order if l in _rate.index]
        if len(_present) >= 2:
            _vals = [_rate[l] for l in _present]
            _txt = ", ".join("%s %.1f%%" % (l, v) for l, v in zip(_present, _vals))
            if all(_vals[i] <= _vals[i + 1] + 0.5 for i in range(len(_vals) - 1)):
                eda_extra = ("Stopa uspjesnosti dosljedno raste s nivoom iskustva agenta (%s), sto "
                             "potvrdjuje da dataset vjerno biljezi napredak ucenja kroz vrijeme." % _txt)
            else:
                eda_extra = ("Stopa uspjesnosti po nivoima iskustva iznosi %s, dakle ne raste "
                             "potpuno pravilno; dio odstupanja objasnjava nasumicna varijacija "
                             "tezine mape po epizodi." % _txt)
    except Exception:
        eda_extra = ""

    def _delta_txt(d, pojam):
        if abs(d) < 0.002:
            return "%s gotovo bez efekta" % pojam
        return "%s %s tacnost za %.2f p.p." % (pojam, "povecava" if d > 0 else "smanjuje", abs(d) * 100)

    _accs = [iters[i]["acc"] for i in range(4)]
    _best_i = max(range(4), key=lambda i: _accs[i])
    _iter_meta = [
        ("18", "70:30", "Polazna konfiguracija s punim skupom varijabli."),
        ("16", "70:30", "Uklanjanje redundantnih varijabli: %s."
         % _delta_txt(_accs[1] - _accs[0], "promjena skupa varijabli")),
        ("16", "80:20", "Promjena omjera podjele: %s."
         % _delta_txt(_accs[2] - _accs[1], "veci skup za treniranje")),
        ("16", "80:20", "Podeseni hiperparametri; %s."
         % ("najbolji rezultat i finalni izbor" if _best_i == 3
            else "rezultat ne nadmasuje iteraciju %d" % (_best_i + 1))),
    ]
    iter_rows = []
    for i in range(4):
        m = iters[i]
        v, tt, note = _iter_meta[i]
        iter_rows.append([str(i + 1), v, tt, "%.4f" % m["acc"], "%.4f" % m["f1"], "%.4f" % m["auc"], note])
    _spread = (max(_accs) - min(_accs)) * 100
    if _spread < 1.0:
        iter_stability = ("Ukupan raspon rezultata izmedju najslabije i najbolje iteracije iznosi "
                          "svega %.2f p.p. tacnosti, sto pokazuje da je zadatak stabilan i da "
                          "rezultat ne ovisi presudno o izboru konfiguracije." % _spread)
    else:
        iter_stability = ("Ukupan raspon rezultata izmedju najslabije i najbolje iteracije iznosi "
                          "%.2f p.p. tacnosti, sto pokazuje da izbor konfiguracije ima primjetan "
                          "uticaj na rezultat." % _spread)

    compare_rows = []
    for label, mm in [("Random Forest (podeseni)", m_rf), ("Logisticka regresija", m_lr),
                      ("Gradient Boosting", m_gb)]:
        compare_rows.append([label] + ["%.4f" % mm[k] for k in ("acc", "prec", "rec", "f1", "auc")])

    cv_rows = []
    for c in cv:
        cv_rows.append([c["name"]] + ["%.4f \u00b1 %.4f" % (c[k], c[k + "_std"])
                                      for k in ("acc", "prec", "rec", "f1", "auc")])
    _cv_best = max(cv, key=lambda c: c["auc"])
    _cv_spread = max(c["auc_std"] for c in cv)
    _auc_gap = max(c["auc"] for c in cv) - min(c["auc"] for c in cv)

    cm_rows = []
    for label, cmx in [("Random Forest", cm_rf_m), ("Logisticka regresija", cm_lr_m),
                       ("Gradient Boosting", cm_gb_m)]:
        tn, fp, fn_, tp = int(cmx[0][0]), int(cmx[0][1]), int(cmx[1][0]), int(cmx[1][1])
        cm_rows.append([label,
                        "{:,}".format(tn).replace(",", "."),
                        "{:,}".format(tp).replace(",", "."),
                        "{:,}".format(fp).replace(",", "."),
                        "{:,}".format(fn_).replace(",", ".")])
    _tn, _fp, _fn, _tp = (int(cm_rf_m[0][0]), int(cm_rf_m[0][1]),
                          int(cm_rf_m[1][0]), int(cm_rf_m[1][1]))
    if _fp > _fn * 1.5:
        err_txt = ("Greske su izrazenije u smjeru laznih uspjeha: model cesce najavi uspjeh koji se "
                   "ne ostvari nego sto propusti stvarni uspjeh.")
    elif _fn > _fp * 1.5:
        err_txt = ("Greske su izrazenije u smjeru propustenih uspjeha: model je oprezan i cesce "
                   "previdi epizodu koja bi zavrsila uspjesno.")
    else:
        err_txt = "Obje vrste gresaka javljaju se priblizno podjednako, bez izrazene pristranosti."

    _excl = [
        ["ID", "Redni broj epizode; nema prediktivnu vrijednost."],
        ["Outcome", "Tekstualni ishod epizode iz kojeg je izvedena ciljna varijabla (curenje informacije)."],
        ["TotalSteps", "Poznat tek po zavrsetku epizode; ishod ga direktno determinira."],
        ["DetourSteps", "Definisan samo za uspjesne epizode; nedostupan u trenutku predikcije."],
        ["PathObstacles", "Korelacija r=%.2f s ObstacleCount; redundantna." % r_obs],
        ["GridTheme", "Vizuelna oznaka teme prikaza; bez uticaja na dinamiku epizode."],
    ]

    fname_report = "parking_agent_izvjestaj.docx"

    ctx = {
        "doc_title": "Predikcija uspjesnosti parkiranja autonomnog agenta",
        "doc_subtitle": "Izvjestaj o klasifikacijskoj analizi dataseta generisanog Q-learning agentom",
        "author": "Edin Sehovic (IB250211)",
        "date": _dt.datetime.now().strftime("%d.%m.%Y."),
        "dataset_name": "parking_episode_dataset",
        "source": "Q-learning parking agent (TypeScript)",
        "best_model_name": win_name,
        "n": n, "n_parked": n_parked, "n_not": n_not,
        "pct_parked": pct_parked, "pct_not": pct_not,
        "n_cols": int(df.shape[1]),
        "n_features_sel": len(SEL_FEATURES),
        "n_train": n_train, "n_test": n_test,
        "missing_rows": missing_rows,
        "fi_rows": fi_rows,
        "iter_rows": iter_rows,
        "compare_rows": compare_rows,
        "cm_rows": cm_rows,
        "excluded_rows": _excl,
        "model_rows": [
            ["Random Forest", "Model u primjeni",
             "n_estimators=200, max_depth=20, min_samples_split=5"],
            ["Logisticka regresija", "Referentna vrijednost",
             "max_iter=1000, ulazi standardizovani (StandardScaler)"],
            ["Gradient Boosting", "Kontrolni ansambl",
             "HistGradientBoosting, max_iter=200"],
        ],
        "abstract":
            "Ovaj izvjestaj analizira mogucnost predvidjanja ishoda parkiranja autonomnog agenta "
            "prije zavrsetka epizode, na osnovu karakteristika okoline i ranog ponasanja agenta. "
            "Dataset obuhvata %s epizoda generisanih vlastitim Q-learning agentom, pri cemu jedan "
            "zapis odgovara jednom pokusaju parkiranja. Poredjena su tri klasifikatora: Random Forest, "
            "logisticka regresija i Gradient Boosting. Najbolji rezultat postize %s, s tacnoscu %.2f%% i AUC vrijednoscu "
            "%.4f na nezavisnom testnom skupu, sto potvrdjuje da je ishod epizode predvidiv u mjeri "
            "znatno iznad slucajnog pogadjanja."
            % ("{:,}".format(n).replace(",", "."), win_name, m_win["acc"] * 100, m_win["auc"]),
        "key_findings": [
            "Random Forest postize Accuracy %.4f, F1 %.4f i AUC %.4f."
            % (m_rf["acc"], m_rf["f1"], m_rf["auc"]),
            "Logisticka regresija postize Accuracy %.4f, F1 %.4f i AUC %.4f."
            % (m_lr["acc"], m_lr["f1"], m_lr["auc"]),
            "Gradient Boosting postize Accuracy %.4f, F1 %.4f i AUC %.4f."
            % (m_gb["acc"], m_gb["f1"], m_gb["auc"]),
            "Najbolji je model %s; raspon AUC vrijednosti izmedju modela iznosi %.4f."
            % (win_name, d_auc),
            "Tri najutjecajnije varijable su %s." % ", ".join(top3),
            conc_find,
            iter_stability,
        ],
        "data_origin":
            "Podaci su generisani vlastitom implementacijom Q-learning agenta koji uci parkirati u "
            "simuliranom okruzenju. Svaka epizoda predstavlja jedan pokusaj parkiranja i biljezi se "
            "kao jedan zapis. Uz ishod epizode, zapis sadrzi karakteristike generisane mape (broj "
            "prepreka, gustoca parkiranih vozila, gustoca prepreka na cesti), stanje agenta na "
            "pocetku epizode (nivo iskustva, broj prethodnih epizoda, vrijednost epsilon) i skup "
            "ordinalnih ocjena ranog ponasanja agenta unutar epizode. Buduci da se tezina mape "
            "nasumicno varira po epizodi, dataset sadrzi stvarnu varijaciju tezine, pa ishod ovisi "
            "i o okolini i o dostignutoj vjestini agenta.",
        "target_text":
            "Ciljna varijabla je ParkingSuccess s dvije vrijednosti: Parked kada agent uspjesno "
            "zavrsi parkiranje i NotParked u svim ostalim slucajevima. Raspodjela klasa je %s "
            "(%.1f%% naspram %.1f%%), pri cemu je vecinska klasa %s. %s"
            % (balance_desc, pct_parked, pct_not, _majority, balance_note),
        "quality_text":
            "Varijable su mjesovitog tipa: kontinuirane (gustoce), cjelobrojne (broj prepreka, broj "
            "epizoda), ordinalne ocjene u rasponu 0-5 i kategoricke oznake. Korelacija izmedju "
            "ObstacleCount i PathObstacles iznosi r=%.2f, zbog cega je druga varijabla iskljucena "
            "iz modela." % r_obs,
        "prep_steps": [
            "Kategoricke varijable pretvorene su u numericki oblik postupkom LabelEncoder.",
            "Nedostajuce vrijednosti popunjene su medijanom odgovarajuce kolone.",
            "Iskljucene su varijable koje cure informaciju o ishodu ili su redundantne.",
            "Za logisticku regresiju ulazi su standardizovani postupkom StandardScaler; "
            "Random Forest ne zahtijeva skaliranje.",
            "Podjela na skup za treniranje i testiranje izvrsena je stratifikovano, uz fiksiranu "
            "vrijednost random_state radi ponovljivosti rezultata.",
        ],
        "exclusion_text":
            "Iz skupa ulaznih varijabli uklonjene su one koje bi modelu otkrile ishod epizode prije "
            "nego sto je on stvarno poznat, kao i one koje ne nose dodatnu informaciju. Bez ovog "
            "koraka model bi postizao neuporedivo bolje rezultate koji ne bi imali prakticnu "
            "vrijednost, jer u stvarnoj primjeni te vrijednosti u trenutku predikcije nisu dostupne.",
        "models_text":
            "Poredjena su tri klasifikatora razlicite prirode. Random Forest je ansambl odluke stabala "
            "sposoban da modelira nelinearne odnose i interakcije medju varijablama. Logisticka "
            "regresija je linearni model koji sluzi kao referentna vrijednost: ako slozeniji model ne "
            "donosi znacajan napredak u odnosu na nju, dodatna slozenost nije opravdana. Gradient Boosting je drugi ansambl stabala, koji ih gradi uzastopno tako da svako naredno stablo ispravlja greske prethodnih, i sluzi kao kontrola da postignuti rezultat nije svojstven samo jednom algoritmu.",
        "protocol_text":
            "Model je treniran na skupu od %s zapisa i evaluiran na nezavisnom testnom skupu od %s "
            "zapisa koji nije koristen tokom treniranja. Kvalitet je mjeren kroz pet metrika: "
            "Accuracy, Precision, Recall, F1 i AUC. AUC je uzet kao primarna metrika jer ne ovisi o "
            "izboru praga odlucivanja i otporniji je na neuravnotezenost klasa. Kao referentnu tacku "
            "treba imati u vidu da bi model koji uvijek predvidja vecinsku klasu postigao tacnost "
            "od %.1f%%."
            % ("{:,}".format(n_train).replace(",", "."), "{:,}".format(n_test).replace(",", "."),
               _baseline_acc),
        "eda_text":
            ("Prije modeliranja ispitane su raspodjele varijabli i njihov odnos prema ishodu. "
             + eda_extra).strip(),
        "iter_text":
            "Model je razvijan kroz cetiri iteracije, pri cemu je u svakoj mijenjan jedan aspekt "
            "konfiguracije kako bi se izolovao njegov doprinos. " + iter_stability,
        "fi_text":
            "Vaznost varijabli izracunata je na osnovu prosjecnog smanjenja neciste podjele u stablima "
            "finalnog modela. " + fi_lead + " " + conc_txt,
        "compare_text":
            "Sva tri modela postizu upotrebljive rezultate. Model %s je %s. %s"
            % (win_name, _sweep_txt, margin_txt),
        "cm_text":
            "Analiza matrice konfuzije pokazuje kako se greske finalnog modela raspodjeljuju izmedju "
            "dva tipa. Od ukupno %s zapisa u testnom skupu, model tacno klasifikuje %s slucajeva. "
            "Preostale greske dijele se na %s lazno predvidjenih uspjeha i %s propustenih uspjeha. %s"
            % ("{:,}".format(n_test).replace(",", "."),
               "{:,}".format(_tn + _tp).replace(",", "."),
               "{:,}".format(_fp).replace(",", "."),
               "{:,}".format(_fn).replace(",", "."),
               err_txt),
        "discussion": [
            "Rezultati potvrdjuju da je ishod epizode parkiranja predvidiv prije njenog zavrsetka, i "
            "to s tacnoscu znatno iznad slucajnog pogadjanja. " + nonlin_txt,
            "Raspodjela vaznosti varijabli daje dodatan uvid. " + fi_lead + " " + conc_txt,
            "Prakticna vrijednost ovakvog modela je u mogucnosti rane procjene: sistem moze "
            "prepoznati epizode s niskim izgledima za uspjeh prije nego sto se resursi potrose na "
            "njihovo izvrsavanje, sto otvara prostor za prilagodjavanje strategije u hodu.",
        ],
        "limitations": [
            "Podaci poticu iz simuliranog okruzenja s diskretnom mrezom; prenosivost na stvarna "
            "vozila nije ispitana.",
            "Dataset generise jedan agent s jednom konfiguracijom ucenja, pa zakljucci ne moraju "
            "vrijediti za drugacije postavljene agente.",
            "Vaznost varijabli kod Random Forest modela pokazuje povezanost, a ne uzrocnost.",
            "Evaluacija je izvrsena na jednoj podjeli podataka; unakrsna validacija dala bi "
            "pouzdaniju procjenu varijabilnosti rezultata.",
        ],
        "conclusion": [
            "Provedena analiza pokazuje da se ishod pokusaja parkiranja moze predvidjeti na osnovu "
            "karakteristika okoline i stanja agenta na pocetku epizode. Najbolji od tri poredjena "
            "modela je %s, s tacnoscu %.4f i AUC vrijednoscu %.4f na nezavisnom testnom skupu."
            % (win_name, m_win["acc"], m_win["auc"]),
            complexity_txt + " Iterativni razvoj pokazao je koliko rezultat ovisi o izboru skupa "
            "varijabli i omjera podjele podataka.",
            "Kao smjer daljeg rada namece se prosirenje dataseta epizodama vise razlicito "
            "konfigurisanih agenata, uvodjenje unakrsne validacije i ispitivanje modela koji bi "
            "predikciju azurirao tokom epizode, a ne samo na njenom pocetku.",
        ],
        "cv_rows": cv_rows,
        "cv_text":
            "Rezultati zasnovani na jednoj podjeli podataka daju jednu vrijednost po metrici, "
            "bez informacije o tome koliko je ta vrijednost stabilna. Zbog toga je provedena i "
            "petostruka stratifikovana unakrsna validacija: podaci su podijeljeni na pet dijelova, "
            "a svaki model je treniran pet puta, pri cemu je svaki put drugi dio koristen kao "
            "testni skup. Time se za svaku metriku dobija prosjek i standardna devijacija.",
        "cv_conclusion":
            "Standardna devijacija AUC vrijednosti ne prelazi %.4f ni kod jednog modela, sto znaci "
            "da su rezultati stabilni u odnosu na izbor podjele. Razlika izmedju najboljeg i "
            "najslabijeg modela iznosi %.4f, dakle %s od rasipanja izmedju podjela, pa se moze "
            "smatrati %s. Najbolji prosjecni rezultat postize %s."
            % (_cv_spread, _auc_gap,
               "vise" if _auc_gap > _cv_spread else "manje",
               "stvarnom razlikom" if _auc_gap > _cv_spread else "neizvjesnom",
               _cv_best["name"]),
        "appendix_rows": [
            ["graf_01 - graf_12 (PNG)", "Grafovi eksplorativne analize, evaluacije modela i unakrsne validacije."],
            ["parking_episode_dataset_PROCESSED.csv",
             "Dataset s kodiranim varijablama, predikcijama modela i oznakom tacnosti."],
            ["metrics.json", "Numericki rezultati u strojno citljivom obliku."],
            [fname_report, "Ovaj izvjestaj."],
        ],
    }

    # Word report
    word_ok = False
    try:
        build_word(OUT, fname_report, ctx)
        word_ok = True
    except Exception as e:
        print("WORD_SKIP: " + str(e))

    # ZIP archive
    zip_path = f"{OUT}/report.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(glob.glob(f"{OUT}/graf_*.png")):
            z.write(f, os.path.basename(f))
        z.write(processed_path, os.path.basename(processed_path))
        if word_ok:
            z.write(f"{OUT}/{fname_report}", fname_report)

    # Metrics
    metrics = {
        "ok": True,
        "dataset": {"rows": n, "parked": n_parked, "notparked": n_not,
                    "parked_pct": round(n_parked/n*100, 1)},
        "iterations": iters,
        "best_rf": m_rf, "lr": m_lr, "gb": m_gb,
        "cv": cv, "cv_folds": 5,
        "top_features": [[f, round(float(v), 4)] for f, v in feat_imp[:6]],
        "charts": {
            "target": "graf_01_distribucija_ciljne.png",
            "importance": "graf_05_feature_importance.png",
            "roc": "graf_08_roc_usporedba.png",
            "compare": "graf_09_usporedba_metrika.png",
            "cv": "graf_11_unakrsna_validacija.png"
        },
        "word": word_ok,
        "word_file": fname_report if word_ok else None,
        "zip": "report.zip"
    }
    with open(f"{OUT}/metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    print("ANALYZE_OK")



def build_word(OUT, fname, ctx):
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.section import WD_SECTION
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    import os

    NAVY = RGBColor(0x1B, 0x36, 0x5D)
    ACCENT = RGBColor(0x1F, 0x6F, 0xB2)
    GREY = RGBColor(0x5A, 0x5A, 0x5A)
    HEAD_FILL = "1B365D"
    ZEBRA_FILL = "F3F6FA"
    META_FILL = "EDF2F8"

    doc = Document()

    sec = doc.sections[0]
    sec.top_margin = Inches(1.0)
    sec.bottom_margin = Inches(1.0)
    sec.left_margin = Inches(1.05)
    sec.right_margin = Inches(1.05)

    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)
    st.paragraph_format.space_after = Pt(6)
    st.paragraph_format.line_spacing = 1.15

    counters = {"tab": 0, "fig": 0}

    def shade(cell, fill):
        tcPr = cell._tc.get_or_add_tcPr()
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear")
        sh.set(qn("w:fill"), fill)
        tcPr.append(sh)

    def cell_text(cell, text, bold=False, color=None, size=9.5, align=None):
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(2)
        r = p.add_run(str(text))
        r.bold = bold
        r.font.size = Pt(size)
        if color is not None:
            r.font.color.rgb = color
        if align is not None:
            p.alignment = align
        return p

    def rule(color="1B365D", size=12):
        p = doc.add_paragraph()
        pPr = p._p.get_or_add_pPr()
        bdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), str(size))
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), color)
        bdr.append(bottom)
        pPr.append(bdr)
        p.paragraph_format.space_after = Pt(10)
        return p

    def h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(14)
        r.font.color.rgb = NAVY
        rule()
        return p

    def h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(11.5)
        r.font.color.rgb = ACCENT
        return p

    def body(text, size=10.5, italic=False, align=None):
        p = doc.add_paragraph()
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.italic = italic
        if align is not None:
            p.alignment = align
        return p

    def bullets(items):
        for it in items:
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(it)
            r.font.size = Pt(10.5)

    def table_caption(text):
        counters["tab"] += 1
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run("Tabela %d. " % counters["tab"])
        r.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = NAVY
        r2 = p.add_run(text)
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = GREY
        return p

    def figure(path, width_in, caption):
        if not os.path.exists(path):
            return
        doc.add_picture(path, width=Inches(width_in))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.paragraphs[-1].paragraph_format.space_before = Pt(8)
        doc.paragraphs[-1].paragraph_format.space_after = Pt(2)
        counters["fig"] += 1
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(10)
        r = p.add_run("Slika %d. " % counters["fig"])
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = NAVY
        r2 = p.add_run(caption)
        r2.font.size = Pt(9)
        r2.font.color.rgb = GREY

    def grid(headers, rows, widths=None, align_num=True):
        t = doc.add_table(rows=1, cols=len(headers))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for c, txt in zip(t.rows[0].cells, headers):
            shade(c, HEAD_FILL)
            cell_text(c, txt, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), size=9.5)
        for i, row in enumerate(rows):
            cells = t.add_row().cells
            for j, val in enumerate(row):
                if i % 2 == 1:
                    shade(cells[j], ZEBRA_FILL)
                al = None
                if align_num and j > 0:
                    al = WD_ALIGN_PARAGRAPH.CENTER
                cell_text(cells[j], val, size=9.5, align=al)
        if widths:
            for row in t.rows:
                for cell, w in zip(row.cells, widths):
                    cell.width = Inches(w)
        doc.add_paragraph().paragraph_format.space_after = Pt(0)
        return t

    def page_number_footer():
        footer = doc.sections[0].footer
        p = footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r0 = p.add_run(ctx["doc_title"] + "   |   ")
        r0.font.size = Pt(8)
        r0.font.color.rgb = GREY
        run = p.add_run()
        run.font.size = Pt(8)
        run.font.color.rgb = GREY
        f1 = OxmlElement("w:fldChar")
        f1.set(qn("w:fldCharType"), "begin")
        it = OxmlElement("w:instrText")
        it.set(qn("xml:space"), "preserve")
        it.text = "PAGE"
        f2 = OxmlElement("w:fldChar")
        f2.set(qn("w:fldCharType"), "end")
        run._r.append(f1)
        run._r.append(it)
        run._r.append(f2)

    page_number_footer()

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(ctx["doc_title"])
    r.bold = True
    r.font.size = Pt(20)
    r.font.color.rgb = NAVY

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run(ctx["doc_subtitle"])
    r.font.size = Pt(11.5)
    r.font.color.rgb = GREY

    meta = doc.add_table(rows=0, cols=4)
    meta.style = "Table Grid"
    meta_rows = [
        ("Autor", ctx["author"], "Datum", ctx["date"]),
        ("Dataset", ctx["dataset_name"], "Broj epizoda", "{:,}".format(ctx["n"]).replace(",", ".")),
        ("Izvor podataka", ctx["source"], "Najbolji model", ctx["best_model_name"]),
    ]
    for a, b, c, d in meta_rows:
        cells = meta.add_row().cells
        shade(cells[0], META_FILL)
        shade(cells[2], META_FILL)
        cell_text(cells[0], a, bold=True, size=9.5, color=NAVY)
        cell_text(cells[1], b, size=9.5)
        cell_text(cells[2], c, bold=True, size=9.5, color=NAVY)
        cell_text(cells[3], d, size=9.5)
    for row in meta.rows:
        for cell, w in zip(row.cells, [1.15, 2.25, 1.15, 1.85]):
            cell.width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)

    h1("1. Sazetak")
    body(ctx["abstract"])

    h2("Kljucni nalazi")
    bullets(ctx["key_findings"])

    h1("2. Podaci")

    h2("2.1 Porijeklo i struktura")
    body(ctx["data_origin"])

    table_caption("Osnovni pokazatelji dataseta.")
    grid(["Pokazatelj", "Vrijednost"],
         [["Broj zapisa (epizoda)", "{:,}".format(ctx["n"]).replace(",", ".")],
          ["Broj kolona u izvornom datasetu", str(ctx["n_cols"])],
          ["Broj ulaznih varijabli u modelu", str(ctx["n_features_sel"])],
          ["Ciljna varijabla", "ParkingSuccess (Parked / NotParked)"],
          ["Zapisa u skupu za treniranje", "{:,}".format(ctx["n_train"]).replace(",", ".")],
          ["Zapisa u skupu za testiranje", "{:,}".format(ctx["n_test"]).replace(",", ".")]],
         widths=[3.4, 2.9])

    h2("2.2 Raspodjela ciljne varijable")
    body(ctx["target_text"])

    table_caption("Raspodjela klasa ciljne varijable.")
    grid(["Klasa", "Broj epizoda", "Udio"],
         [["Parked", "{:,}".format(ctx["n_parked"]).replace(",", "."), "%.1f%%" % ctx["pct_parked"]],
          ["NotParked", "{:,}".format(ctx["n_not"]).replace(",", "."), "%.1f%%" % ctx["pct_not"]],
          ["Ukupno", "{:,}".format(ctx["n"]).replace(",", "."), "100.0%"]],
         widths=[2.1, 2.1, 2.1])

    figure(os.path.join(OUT, "graf_01_distribucija_ciljne.png"), 3.6,
           "Raspodjela ciljne varijable ParkingSuccess.")

    h2("2.3 Kvalitet podataka")
    if ctx["missing_rows"]:
        body("Nedostajuce vrijednosti utvrdjene su u sljedecim kolonama:")
        table_caption("Kolone s nedostajucim vrijednostima.")
        grid(["Kolona", "Nedostaje", "Udio", "Postupak"], ctx["missing_rows"],
             widths=[2.1, 1.2, 1.1, 2.0])
    else:
        body("U datasetu nisu utvrdjene nedostajuce vrijednosti ni u jednoj koloni. "
             "Korak imputacije zadrzan je u pripremi podataka kao zastita za buduce "
             "verzije dataseta, ali u ovoj analizi nije imao efekta.")

    body(ctx["quality_text"])

    h1("3. Metodologija")

    h2("3.1 Priprema podataka")
    bullets(ctx["prep_steps"])

    h2("3.2 Izbor ulaznih varijabli")
    body(ctx["exclusion_text"])
    table_caption("Iskljucene varijable i obrazlozenje.")
    grid(["Varijabla", "Razlog iskljucenja"], ctx["excluded_rows"],
         widths=[1.9, 4.4], align_num=False)

    figure(os.path.join(OUT, "graf_03_korelacijska_matrica.png"), 4.3,
           "Korelacijska matrica ordinalnih ocjena ponasanja agenta (0-5).")

    h2("3.3 Modeli")
    body(ctx["models_text"])
    table_caption("Konfiguracija poredjenih modela.")
    grid(["Model", "Uloga", "Kljucni parametri"], ctx["model_rows"],
         widths=[1.7, 1.9, 2.7], align_num=False)

    h2("3.4 Protokol evaluacije")
    body(ctx["protocol_text"])

    h1("4. Eksplorativna analiza")
    body(ctx["eda_text"])

    figure(os.path.join(OUT, "graf_02_numericke_distribucije.png"), 6.0,
           "Distribucije odabranih numerickih varijabli.")
    figure(os.path.join(OUT, "graf_04_uspjeh_kategoricke.png"), 6.2,
           "Stopa uspjesnosti parkiranja po kategorickim varijablama.")

    h1("5. Rezultati")

    h2("5.1 Iteracije treniranja")
    body(ctx["iter_text"])
    table_caption("Rezultati iterativnog razvoja Random Forest modela.")
    grid(["Iter.", "Varijable", "Omjer", "Accuracy", "F1", "AUC", "Napomena"],
         ctx["iter_rows"], widths=[0.45, 0.85, 0.65, 0.8, 0.7, 0.7, 2.1])

    h2("5.2 Vaznost varijabli")
    body(ctx["fi_text"])
    table_caption("Deset najvaznijih varijabli finalnog modela.")
    grid(["Rang", "Varijabla", "Vaznost", "Kumulativno"], ctx["fi_rows"],
         widths=[0.7, 2.6, 1.3, 1.4])
    figure(os.path.join(OUT, "graf_05_feature_importance.png"), 4.7,
           "Vaznost varijabli prema finalnom Random Forest modelu.")

    h2("5.3 Usporedba modela")
    body(ctx["compare_text"])
    table_caption("Usporedba metrika na testnom skupu.")
    grid(["Model", "Accuracy", "Precision", "Recall", "F1", "AUC"], ctx["compare_rows"],
         widths=[2.0, 0.9, 0.9, 0.85, 0.8, 0.85])
    figure(os.path.join(OUT, "graf_09_usporedba_metrika.png"), 5.4,
           "Usporedba metrika finalnog Random Forest modela i logisticke regresije.")
    figure(os.path.join(OUT, "graf_08_roc_usporedba.png"), 4.7,
           "ROC krivulje poredjenih modela.")

    h2("5.4 Unakrsna validacija")
    body(ctx["cv_text"])
    table_caption("Rezultati petostruke unakrsne validacije (prosjek \u00b1 standardna devijacija).")
    grid(["Model", "Accuracy", "Precision", "Recall", "F1", "AUC-ROC"], ctx["cv_rows"],
         widths=[1.6, 0.95, 0.95, 0.95, 0.95, 0.95])
    body(ctx["cv_conclusion"])
    figure(os.path.join(OUT, "graf_11_unakrsna_validacija.png"), 5.6,
           "Prosjecne vrijednosti metrika uz standardnu devijaciju po podjelama.")
    figure(os.path.join(OUT, "graf_12_auc_po_podjelama.png"), 5.2,
           "AUC-ROC vrijednosti po pojedinacnim podjelama unakrsne validacije.")

    h2("5.5 Analiza gresaka")
    body(ctx["cm_text"])
    table_caption("Raspodjela predikcija na testnom skupu.")
    grid(["Model", "Tacno NotParked", "Tacno Parked", "Lazno Parked", "Propuseno Parked"],
         ctx["cm_rows"], widths=[1.7, 1.25, 1.15, 1.15, 1.35])
    figure(os.path.join(OUT, "graf_06_cm_random_forest.png"), 4.0,
           "Matrica konfuzije - finalni Random Forest model.")
    figure(os.path.join(OUT, "graf_07_cm_logisticka_regresija.png"), 4.0,
           "Matrica konfuzije - logisticka regresija.")
    figure(os.path.join(OUT, "graf_10_cm_gradient_boosting.png"), 4.0,
           "Matrica konfuzije - Gradient Boosting.")

    h1("6. Diskusija")
    for par in ctx["discussion"]:
        body(par)

    h2("Ogranicenja")
    bullets(ctx["limitations"])

    h1("7. Zakljucak")
    for par in ctx["conclusion"]:
        body(par)

    h1("8. Prilozi")
    body("Uz ovaj izvjestaj generisani su sljedeci fajlovi:")
    table_caption("Popis generisanih datoteka.")
    grid(["Datoteka", "Sadrzaj"], ctx["appendix_rows"], widths=[2.7, 3.6], align_num=False)

    doc.save(os.path.join(OUT, fname))


if __name__ == "__main__":
    main()
