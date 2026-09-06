/*
  Warnings:

  Existing records receive a timestamp before each new required updatedAt column is constrained.

*/
-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('MASTER', 'THUMBNAIL', 'GALLERY', 'MOCKUP', 'BANNER');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('INITIAL_STOCK', 'RESTOCK', 'CORRECTION', 'DAMAGED', 'RETURNED');

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "licenseReference" TEXT,
ADD COLUMN     "rightsHolder" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "status" "ArtworkStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "Category" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "Collection" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Collection" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "variantId" TEXT;

UPDATE "Media" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Media" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "ProductVariant" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL,
    "actorId" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAdjustment_inventoryId_createdAt_idx" ON "InventoryAdjustment"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Media_productId_sortOrder_idx" ON "Media"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_artworkId_sortOrder_idx" ON "Media"("artworkId", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_variantId_sortOrder_idx" ON "Media"("variantId", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_categoryId_sortOrder_idx" ON "Media"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_collectionId_sortOrder_idx" ON "Media"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_artworkId_idx" ON "Product"("artworkId");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_productId_idx" ON "ProductCategory"("categoryId", "productId");

-- CreateIndex
CREATE INDEX "ProductCollection_collectionId_productId_idx" ON "ProductCollection"("collectionId", "productId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
