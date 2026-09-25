-- CreateTable
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAllergenAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAllergenAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_title_key" ON "Allergen"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAllergenAssignment_clientId_allergenId_key"
ON "ClientAllergenAssignment"("clientId", "allergenId");

-- CreateIndex
CREATE INDEX "ClientAllergenAssignment_allergenId_idx"
ON "ClientAllergenAssignment"("allergenId");

-- AddForeignKey
ALTER TABLE "ClientAllergenAssignment"
ADD CONSTRAINT "ClientAllergenAssignment_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAllergenAssignment"
ADD CONSTRAINT "ClientAllergenAssignment_allergenId_fkey"
FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedDictionary
INSERT INTO "Allergen" ("id", "title", "description", "updatedAt") VALUES
('css1zyiwzsvsklsz0m9att4yz', 'Акрилаты и метакрилаты', 'Мономеры и материалы для моделирования ногтей', CURRENT_TIMESTAMP),
('cuywbdywp6s4sk6wxz2b61wsp', 'HEMA (2-гидроксиэтилметакрилат)', 'Мономер в гелевых материалах', CURRENT_TIMESTAMP),
('clga45sq6qs8v27p6grymepdc', 'Цианоакрилаты', 'Клеи для ногтей и типсов', CURRENT_TIMESTAMP),
('c630cqoneb6tpkjpocjo8dh49', 'Формальдегид и формальдегидные смолы', 'Компоненты некоторых лаков и укрепителей', CURRENT_TIMESTAMP),
('coblvqprb59gvvg9ilk5l2f1z', 'Латекс', 'Перчатки и расходные материалы', CURRENT_TIMESTAMP),
('c7zpvaa2h30eihufkemxyl502', 'Никель', 'Металлические инструменты и декор', CURRENT_TIMESTAMP),
('cvvzfoy6d3eqpv0xpollaryo9', 'Бензоилпероксид', 'Компонент акриловых систем', CURRENT_TIMESTAMP),
('c3cxr3uwzt32wvmh3qp0mqykk', 'Гидрохинон', 'Компонент некоторых акриловых систем', CURRENT_TIMESTAMP);
