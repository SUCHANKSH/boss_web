import { Algorithm, hash } from '@node-rs/argon2';
import {
  ArtworkStatus,
  CollectionStatus,
  InventoryAdjustmentReason,
  ProductStatus,
  UserRole,
  prisma,
} from '../src/index.js';

const passwordHash = await hash('DevelopmentOnlyPassword123!', { algorithm: Algorithm.Argon2id });
const admin = await prisma.user.upsert({
  where: { email: 'admin@boss.local' },
  update: { role: UserRole.ADMIN, passwordHash },
  create: {
    email: 'admin@boss.local',
    name: 'Development Admin',
    role: UserRole.ADMIN,
    passwordHash,
  },
});
await prisma.user.upsert({
  where: { email: 'customer@boss.local' },
  update: { passwordHash },
  create: { email: 'customer@boss.local', name: 'Development Customer', passwordHash },
});
const sports = await prisma.category.upsert({
  where: { slug: 'sports' },
  update: {},
  create: { name: 'Sports', slug: 'sports', sortOrder: 10 },
});
const cricket = await prisma.category.upsert({
  where: { slug: 'cricket' },
  update: { parentId: sports.id },
  create: { name: 'Cricket', slug: 'cricket', parentId: sports.id, sortOrder: 10 },
});
await prisma.category.upsert({
  where: { slug: 'anime' },
  update: {},
  create: { name: 'Anime', slug: 'anime', sortOrder: 20 },
});
await prisma.category.upsert({
  where: { slug: 'cars' },
  update: {},
  create: { name: 'Cars', slug: 'cars', sortOrder: 30 },
});
const collection = await prisma.collection.upsert({
  where: { slug: 'virat-kohli-collection' },
  update: { status: CollectionStatus.ACTIVE },
  create: {
    name: 'Virat Kohli Collection',
    slug: 'virat-kohli-collection',
    status: CollectionStatus.ACTIVE,
  },
});
const artwork = await prisma.artwork.upsert({
  where: { slug: 'virat-kohli-celebration' },
  update: { status: ArtworkStatus.ACTIVE },
  create: {
    title: 'Virat Kohli Celebration',
    slug: 'virat-kohli-celebration',
    tags: ['sports', 'cricket', 'development'],
    status: ArtworkStatus.ACTIVE,
    sourceType: 'DEVELOPMENT_PLACEHOLDER',
  },
});
const poster = await prisma.product.upsert({
  where: { slug: 'virat-kohli-celebration-poster' },
  update: { artworkId: artwork.id, status: ProductStatus.ACTIVE },
  create: {
    name: 'Virat Kohli Celebration Poster',
    slug: 'virat-kohli-celebration-poster',
    productType: 'POSTER',
    artworkId: artwork.id,
    status: ProductStatus.ACTIVE,
    publishedAt: new Date(),
  },
});
const framed = await prisma.product.upsert({
  where: { slug: 'virat-kohli-celebration-framed-poster' },
  update: { artworkId: artwork.id, status: ProductStatus.ACTIVE },
  create: {
    name: 'Virat Kohli Celebration Framed Poster',
    slug: 'virat-kohli-celebration-framed-poster',
    productType: 'FRAMED_POSTER',
    artworkId: artwork.id,
    status: ProductStatus.ACTIVE,
    publishedAt: new Date(),
  },
});
await prisma.product.upsert({
  where: { slug: 'naruto-draft-poster' },
  update: {},
  create: {
    name: 'Naruto Draft Poster',
    slug: 'naruto-draft-poster',
    productType: 'POSTER',
    status: ProductStatus.DRAFT,
  },
});
await prisma.product.upsert({
  where: { slug: 'archived-development-print' },
  update: {},
  create: {
    name: 'Archived Development Print',
    slug: 'archived-development-print',
    productType: 'ART_PRINT',
    status: ProductStatus.ARCHIVED,
  },
});
for (const product of [poster, framed]) {
  await prisma.productCategory.upsert({
    where: { productId_categoryId: { productId: product.id, categoryId: cricket.id } },
    update: {},
    create: { productId: product.id, categoryId: cricket.id },
  });
  await prisma.productCollection.upsert({
    where: { productId_collectionId: { productId: product.id, collectionId: collection.id } },
    update: {},
    create: { productId: product.id, collectionId: collection.id },
  });
}
const a4 = await prisma.productVariant.upsert({
  where: { sku: 'DEV-VIRAT-POSTER-A4' },
  update: { productId: poster.id, isActive: true },
  create: {
    productId: poster.id,
    sku: 'DEV-VIRAT-POSTER-A4',
    name: 'A4 / Unframed',
    attributes: { size: 'A4', frame: 'UNFRAMED' },
    pricePaise: 49900,
    inventory: { create: { available: 20, reorderLevel: 5 } },
  },
});
await prisma.productVariant.upsert({
  where: { sku: 'DEV-VIRAT-POSTER-A3' },
  update: { productId: poster.id },
  create: {
    productId: poster.id,
    sku: 'DEV-VIRAT-POSTER-A3',
    name: 'A3 / Unframed',
    attributes: { size: 'A3', frame: 'UNFRAMED' },
    pricePaise: 79900,
    inventory: { create: { available: 3, reorderLevel: 5 } },
  },
});
await prisma.productVariant.upsert({
  where: { sku: 'DEV-VIRAT-FRAMED-A4-BLACK' },
  update: { productId: framed.id },
  create: {
    productId: framed.id,
    sku: 'DEV-VIRAT-FRAMED-A4-BLACK',
    name: 'A4 / Black Frame',
    attributes: { size: 'A4', frame: 'BLACK' },
    pricePaise: 129900,
    inventory: { create: { available: 8 } },
  },
});
const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: a4.id } });
await prisma.inventoryAdjustment.upsert({
  where: { id: 'seed-initial-stock-virat-a4' },
  update: {},
  create: {
    id: 'seed-initial-stock-virat-a4',
    inventoryId: inventory.id,
    delta: 20,
    reason: InventoryAdjustmentReason.INITIAL_STOCK,
    actorId: admin.id,
    note: 'Repeatable development seed',
  },
});
await prisma.media.upsert({
  where: { storageKey: 'development/artwork/virat-kohli-celebration/master.jpg' },
  update: { artworkId: artwork.id },
  create: {
    scope: 'PUBLIC_PRODUCT',
    purpose: 'MASTER',
    storageProvider: 'DEVELOPMENT_PLACEHOLDER',
    storageKey: 'development/artwork/virat-kohli-celebration/master.jpg',
    url: 'https://example.invalid/development/virat-master.jpg',
    mimeType: 'image/jpeg',
    artworkId: artwork.id,
    altText: 'Development placeholder artwork master',
  },
});
await prisma.$disconnect();
