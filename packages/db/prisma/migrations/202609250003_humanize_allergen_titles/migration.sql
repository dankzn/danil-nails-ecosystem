-- CleanupData
-- The original allergen dictionary used raw chemistry/dermatology terms
-- ("Бензоилпероксид", "Гидрохинон", "Цианоакрилаты"...) that neither
-- clients nor most admins recognize. Rewrite every entry using the plain
-- salon-language groups from docs/05-requirements.md, keeping the
-- technical detail in `description` (shown as a tooltip in the CRM).
-- HEMA is folded into the acrylates/gel group per that same requirement
-- ("акрилаты и метакрилаты, включая HEMA"), so its row is removed;
-- ClientAllergenAssignment rows referencing it cascade away with it.

UPDATE "Allergen"
SET "title" = 'Гель-лак, гель и акрил для наращивания',
    "description" = 'Акрилаты и метакрилаты, включая HEMA — основа гелей, гель-лаков и акриловых систем',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'css1zyiwzsvsklsz0m9att4yz';

DELETE FROM "Allergen" WHERE "id" = 'cuywbdywp6s4sk6wxz2b61wsp';

UPDATE "Allergen"
SET "title" = 'Клей для типс, страз и декора',
    "description" = 'Клеевые составы (цианоакрилатный клей)',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'clga45sq6qs8v27p6grymepdc';

UPDATE "Allergen"
SET "title" = 'Консерванты в лаке и уходовых средствах',
    "description" = 'Консерванты, в том числе формальдегидные смолы, в лаках и укрепителях',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'c630cqoneb6tpkjpocjo8dh49';

UPDATE "Allergen"
SET "title" = 'Латекс (перчатки)',
    "description" = 'Латексные перчатки и расходные материалы',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'coblvqprb59gvvg9ilk5l2f1z';

UPDATE "Allergen"
SET "title" = 'Никель (металлические инструменты и декор)',
    "description" = 'Металлические пилки, инструменты, металлический декор',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'c7zpvaa2h30eihufkemxyl502';

UPDATE "Allergen"
SET "title" = 'Отдушки и ароматизаторы',
    "description" = 'Ароматические компоненты в кремах, лаках и средствах для рук',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cvvzfoy6d3eqpv0xpollaryo9';

UPDATE "Allergen"
SET "title" = 'Антисептики и средства для дезинфекции',
    "description" = 'Средства для обработки рук и инструментов',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'c3cxr3uwzt32wvmh3qp0mqykk';
