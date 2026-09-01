export interface SelectedHistoryOffer {
  productKey?: string | null;
  commodity?: string | null;
}

export function resolveSelectedHistoryProduct<
  T extends { productKey?: string | null; type?: string | null },
>(products: T[], selectedOffer?: SelectedHistoryOffer | null): T | null {
  if (!Array.isArray(products) || products.length === 0) return null;

  const selectedKey = selectedOffer?.productKey?.trim();
  if (!selectedKey) return products[0] ?? null;

  const exact = products.find((product) => product.productKey === selectedKey);
  if (exact) return exact;

  const commodity = (selectedOffer?.commodity ?? "").toUpperCase();
  const orderedProducts =
    commodity === "GAS"
      ? products.filter((product) => {
          const key = product.productKey ?? "";
          return product.type === "GAS" || key.toUpperCase().startsWith("GAS:");
        })
      : products.filter((product) => {
          const key = product.productKey ?? "";
          return (
            product.type !== "GAS" && !key.toUpperCase().startsWith("GAS:")
          );
        });

  const candidates = orderedProducts.length > 0 ? orderedProducts : products;
  const tierKey = selectedKey.split(":").pop();

  if (tierKey) {
    const tierMatch = candidates.find((product) => {
      const key = product.productKey ?? "";
      return key.split(":").pop() === tierKey;
    });
    if (tierMatch) return tierMatch;
  }

  return candidates[0] ?? null;
}
