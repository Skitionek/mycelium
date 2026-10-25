import numpy as np
import pandas as pd
from scipy.stats.distributions import hypergeom
from statsmodels.stats.multitest import fdrcorrection


def add_q_value(df, related_go_terms_count, inplace=True):
    p_values = df["p-value"]
    extended_p_values = pd.concat(
        # The term count is approximate, so it is not trusted to cover the rows.
        [p_values, pd.Series(np.ones(max(related_go_terms_count - len(p_values), 0)))]
    ).reset_index(drop=True)
    r = fdrcorrection(extended_p_values, method="indep")
    if inplace:
        df["rejected"] = r[0][: len(p_values)]
        df["q-value"] = r[1][: len(p_values)]
    else:
        return r


def fisher_p(k, M, n, N):
    """
    :param k: drawn type I objects
    :param M: total number of objects
    :param n: total number of type I objects
    :param N: draws without replacement
    :return: p
    """
    # return fisher_exact([[k, n-k], [N-k, M-(N+n-k)]], "greater")[1]
    # equivalent to using scipy.stats.fisher_exact:
    return hypergeom.cdf(n - k, M, n, M - N)


def fisher(geneNames, GOterms, related_go_terms_count):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    df = pd.DataFrame(GOterms)
    universe = set(df["geneNames"].explode().dropna())
    # A submitted gene no term mentions lies outside the universe the terms
    # are drawn from; counting it as drawn would leave the test undefined.
    query = [gene for gene in dict.fromkeys(geneNames) if gene in universe]
    M = len(universe)
    N = len(query)

    def f(go):
        term_genes = set(go["geneNames"])
        matching_gene_names = [gene for gene in query if gene in term_genes]
        go["p-value"] = fisher_p(len(matching_gene_names), M, len(go["geneNames"]), N)
        go["gene"] = f"{go['goTerm']} ({go['goId']})"
        go["geneNames"] = matching_gene_names
        return go

    df = df.apply(f, axis=1).sort_values(by="p-value")

    add_q_value(df, related_go_terms_count)
    return df.to_json(orient="records")
