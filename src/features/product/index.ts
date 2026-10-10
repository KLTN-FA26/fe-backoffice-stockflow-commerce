export type {
  Category,
  PrintArea,
  PrintTechnique,
  Product,
  ProductAttribute,
  ProductStatus,
  ProductType,
  Uom,
} from "./types";

export {
  bilingualLabelSchema,
  categorySchema,
  createProductSchema,
  printAreaSchema,
  printTechniqueSchema,
  printTechniqueValues,
  pricingFormulaSchema,
  productAttributeSchema,
  productDraftFormSchema,
  productMasterDtoSchema,
  productSchema,
  productStatusSchema,
  productStatusValues,
  productTypeSchema,
  productTypeValues,
  transitionProductSchema,
  updateProductSchema,
  uomSchema,
  uomValues,
} from "./schemas";
export type {
  BrandDto,
  CategoryDto,
  CreateProductInput,
  ProductDraftFormValues,
  ProductMasterDto,
  ProductDto,
  ProductStatusValue,
  ProductTypeValue,
  TransitionProductInput,
  UpdateProductInput,
} from "./schemas";

export {
  PRODUCT_ACTIONS,
  PRODUCT_TRANSITIONS,
  allowedProductActions,
  allowedTransitions,
  canTransition,
  isProductTerminal,
  isSelfApproval,
  isTerminal,
  nextProductStatuses,
} from "./lifecycle";
export type { ProductAction } from "./lifecycle";

export { attributesForProducts, categoryName, formatVnd, shouldFlagProductRow } from "./selectors";

export {
  PRODUCT_DRAFT_FORM_DEFAULTS,
  buildCreateProductInput,
  mapCreateProductError,
  productToDraftForm,
} from "./create-product-form";
export type {
  CreateProductServerField,
  CreateProductServerErrors,
  ProductCreateFormSnapshot,
} from "./create-product-form";

export {
  brandKeys,
  categoryKeys,
  productKeys,
  useBrands,
  useCategories,
  useProduct,
  useProducts,
} from "./queries";

export {
  usePublishProduct,
  useCreateProduct,
  useTransitionProduct,
  useUpdateProduct,
  useUnpublishProduct,
} from "./mutations";

export { productTransitionErrorMessage } from "./transition-errors";
export { toProductApiPage, toProductUiPage } from "./pagination";

export type { ListProductsParams } from "./api";

/* ── Biến thể / logistics theo SKU / ảnh theo biến thể (BE PR #71) ───── */
export type {
  LogisticsFormValues,
  SkuLogistics,
  StorageClass,
  Variant,
  VariantInput,
  VariantMedia,
  VariantStatus,
} from "./variant-schemas";
export {
  STORAGE_CLASSES,
  VARIANT_STATUSES,
  logisticsFormSchema,
  variantInputSchema,
} from "./variant-schemas";
export type { VariantTransition } from "./variant-api";
export { allowedVariantActions, countVariantsByStatus, VARIANT_ACTIONS } from "./variant-lifecycle";
export type { VariantAction } from "./variant-lifecycle";
export { variantErrorMessage } from "./variant-errors";
export {
  useAddVariant,
  useDeleteVariantMedia,
  useMakePrimaryMedia,
  useMediaViewUrl,
  usePublishVariantMedia,
  useSaveSkuLogistics,
  useSkuLogistics,
  useTransitionVariant,
  useUpdateVariant,
  useUploadVariantMedia,
  useVariantMedia,
  useVariants,
  useWithdrawVariantMedia,
  variantKeys,
} from "./variant-queries";
