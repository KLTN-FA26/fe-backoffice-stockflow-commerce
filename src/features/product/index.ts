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
  DISCONTINUE_REASON_MAX,
  beProductStatusSchema,
  beProductStatusValues,
  createProductSchema,
  discontinueProductSchema,
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
  DiscontinueProductBody,
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
export { mediaCapabilities, productChangeGate } from "./product-capabilities";
export type { MediaCapabilities, ProductChangeGate } from "./product-capabilities";

export { categoryName, formatVnd, shouldFlagProductRow, taxClassLabel } from "./selectors";

export {
  PRODUCT_DRAFT_FORM_DEFAULTS,
  applyServerFieldErrors,
  buildCreateProductInput,
  mapCreateProductError,
  PRODUCT_STALE_MESSAGE,
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
  PRODUCT_HISTORY_ROOT,
  productKeys,
  useBrands,
  useCategories,
  useOpenReferences,
  useProduct,
  useProducts,
  useProductVersions,
} from "./queries";

export {
  useDeleteProduct,
  useDiscontinueProduct,
  usePublishProduct,
  useCreateProduct,
  useResumeProduct,
  useSuspendProduct,
  useTransitionProduct,
  useUpdateProduct,
  useUnpublishProduct,
} from "./mutations";

/* ── Cuối vòng đời: tạm ngưng / tiếp tục / xoá nháp / lịch sử (BE SCRUM-461) ── */
export {
  OPEN_REFERENCE_KINDS,
  PRODUCT_CHANGE_TYPES,
  PRODUCT_REASON_MAX,
  openReferenceSchema,
  openReferencesSchema,
  productVersionSchema,
  suspendProductSchema,
} from "./lifecycle-schemas";
export type {
  OpenReference,
  OpenReferences,
  ProductChangeType,
  ProductVersion,
  ProductVersionPage,
} from "./lifecycle-schemas";
export {
  CHANGE_TYPE_LABEL,
  changedFieldLabel,
  discontinueWarningLabel,
  historyStatusLabel,
  openReferenceKindLabel,
} from "./lifecycle-labels";

export { productTransitionErrorMessage } from "./transition-errors";
export { toProductApiPage, toProductUiPage } from "./pagination";

export type { DiscontinueProductInput, DiscontinueProductResult, ListProductsParams } from "./api";

/* ── Biến thể / ảnh theo biến thể (BE PR #71) ──────────────────────────── */
export type {
  ProductAxis,
  ProductAxisOption,
  Variant,
  VariantInput,
  VariantMedia,
  VariantOption,
  VariantStatus,
} from "./variant-schemas";
export {
  VARIANT_STATUSES,
  variantInputSchema,
  variantInputSchemaFor,
  variantOptionsLabel,
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
  useProductAxes,
  usePublishVariantMedia,
  useTransitionVariant,
  useUpdateVariant,
  useUploadVariantMedia,
  useVariantMedia,
  useVariants,
  useWithdrawVariantMedia,
  variantKeys,
} from "./variant-queries";

/* ── Từ điển thuộc tính (BE PR #113) ─────────────────────────────────── */
export {
  ATTRIBUTE_DATA_TYPES,
  ATTRIBUTE_ROLES,
  attributeFormSchema,
  attributeValueFormSchemaFor,
  canBeVariantAxis,
  holdsValues,
  replaceCategoryAttributesSchema,
} from "./attribute-schemas";
export type {
  Attribute,
  AttributeDataType,
  AttributeFormValues,
  AttributeRole,
  AttributeValue,
  AttributeValueFormValues,
  CategoryAttribute,
} from "./attribute-schemas";
export { attributeErrorMessage } from "./attribute-errors";
export { DATA_TYPE_LABEL, ROLE_LABEL } from "./attribute-labels";
export {
  attributeKeys,
  useActiveAttributes,
  useAddAttributeValue,
  useAttributes,
  useCategoryAttributes,
  useCreateAttribute,
  useDeleteAttribute,
  useDeleteAttributeValue,
  useReplaceCategoryAttributes,
  useUpdateAttribute,
  useUpdateAttributeValue,
} from "./attribute-queries";

/* ── Trục, thuộc tính mô tả, sinh ma trận (BE PR #114–#116) ───────────── */
export {
  MATRIX_MAX_PER_CALL,
  axisInputSchema,
  descriptiveEntryFromDraft,
  generatedSku,
  matrixSize,
  replaceAxesSchema,
  replaceDescriptivesSchema,
} from "./axes-schemas";
export type {
  AxisInput,
  DescriptiveDraft,
  DescriptiveEntry,
  ProductAttributes,
  ProductDescriptive,
} from "./axes-schemas";
export { axesDraftIssue, previewGeneration, previewMatrix, toAxisInputs } from "./axes-draft";
export type { AxisDraft } from "./axes-draft";
export type { GeneratedVariants } from "./variant-schemas";
export {
  useGenerateVariants,
  useProductAttributes,
  useReplaceProductAxes,
  useReplaceProductDescriptives,
} from "./variant-queries";

/* ── Listing TMĐT, giá cơ sở ─────────────────────────────────────────── */
export {
  BASE_PRICE_CURRENCY,
  basePriceFormSchema,
  listingFormSchema,
  normalizeSlug,
} from "./listing-schemas";
export type { Listing, ListingFormValues, SkuPrice } from "./listing-schemas";
export { listingErrorMessage } from "./listing-errors";
export {
  listingKeys,
  useListing,
  useSaveListing,
  useSaveSkuPrice,
  useSkuPrice,
} from "./listing-queries";
export {
  canonicalDecimal,
  purchasingValuesOf,
  skuPurchasingInputSchema,
} from "./purchasing-schemas";
export type {
  SkuPurchasing,
  SkuPurchasingValues,
  ValidSkuPurchasingValues,
} from "./purchasing-schemas";
export type { SaveSkuPurchasingInput } from "./purchasing-api";
export { isPurchasingVersionConflict, isStalePurchasingError } from "./purchasing-errors";
export { skuPurchasingKeys, useSaveSkuPurchasing, useSkuPurchasing } from "./purchasing-queries";
