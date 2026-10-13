const { getDatabase } = require('./DatabaseService');

class ProductService {
    /**
     * Formata e sanitiza as fotos e campos do produto
     */
    formatProduct(row) {
        if (!row) return null;

        let images = [];
        try {
            if (Array.isArray(row.images)) {
                images = row.images;
            } else if (typeof row.images === 'string' && row.images.trim()) {
                images = JSON.parse(row.images);
            }
        } catch (_) {
            images = [];
        }

        if (!Array.isArray(images)) images = [];

        // Filtra URLs válidas e limita a no máximo 5 fotos
        images = images.filter(img => typeof img === 'string' && img.trim()).slice(0, 5);

        // Se o array de fotos estiver vazio mas existir imageUrl legado, usa ele
        if (images.length === 0 && row.imageUrl) {
            images = [row.imageUrl];
        }

        const primaryImage = images[0] || row.imageUrl || null;

        let tags = [];
        try {
            if (Array.isArray(row.tags)) {
                tags = row.tags;
            } else if (typeof row.tags === 'string' && row.tags.trim()) {
                tags = JSON.parse(row.tags);
            }
        } catch (_) {
            tags = [];
        }
        if (!Array.isArray(tags)) tags = [];
        tags = tags.filter(t => typeof t === 'string' && t.trim());

        return {
            ...row,
            brand: row.brand || '',
            promotionalPrice: row.promotionalPrice !== null && row.promotionalPrice !== undefined && row.promotionalPrice !== '' ? parseFloat(row.promotionalPrice) : null,
            minStock: row.minStock !== null && row.minStock !== undefined ? parseInt(row.minStock, 10) : 0,
            unit: row.unit || 'un',
            weight: row.weight !== null && row.weight !== undefined ? parseFloat(row.weight) : 0,
            width: row.width !== null && row.width !== undefined ? parseFloat(row.width) : 0,
            height: row.height !== null && row.height !== undefined ? parseFloat(row.height) : 0,
            length: row.length !== null && row.length !== undefined ? parseFloat(row.length) : 0,
            checkoutUrl: row.checkoutUrl || '',
            tags,
            ean: row.ean || '',
            images,
            imageUrl: primaryImage
        };
    }

    /**
     * Lista produtos pertencentes a uma empresa com filtros opcionais
     */
    async list(companyId, filters = {}) {
        const db = getDatabase();
        if (!db) return [];

        const { search = '', category = '', isActive = 'all', sortBy = 'name', sortOrder = 'ASC' } = filters;

        let query = `
            SELECT 
                p.id, 
                p."companyId", 
                c.name as "companyName",
                p.name, 
                p.description, 
                p.price::float, 
                p."costPrice"::float, 
                p."promotionalPrice"::float,
                p.sku, 
                p.brand,
                p.category, 
                p.stock, 
                p."minStock",
                p.unit,
                p."manageStock", 
                p.weight::float,
                p.width::float,
                p.height::float,
                p.length::float,
                p."checkoutUrl",
                COALESCE(p.tags, '[]') as tags,
                p.ean,
                p."imageUrl", 
                COALESCE(p.images, '[]') as images,
                p."isActive", 
                p."createdAt", 
                p."updatedAt"
            FROM products p
            LEFT JOIN companies c ON p."companyId" = c.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (companyId) {
            query += ` AND p."companyId" = $${paramIndex}`;
            params.push(companyId);
            paramIndex++;
        }

        if (isActive === 'true' || isActive === true) {
            query += ` AND p."isActive" = TRUE`;
        } else if (isActive === 'false' || isActive === false) {
            query += ` AND p."isActive" = FALSE`;
        }

        if (category && category !== 'Todas' && category !== 'all') {
            query += ` AND p.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (search && search.trim()) {
            query += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.category ILIKE $${paramIndex} OR p.brand ILIKE $${paramIndex} OR p.ean ILIKE $${paramIndex} OR p.tags ILIKE $${paramIndex})`;
            params.push(`%${search.trim()}%`);
            paramIndex++;
        }

        const allowedSortCols = {
            name: 'p.name',
            price: 'p.price',
            stock: 'p.stock',
            createdAt: 'p."createdAt"',
            category: 'p.category',
            brand: 'p.brand'
        };
        const sortCol = allowedSortCols[sortBy] || 'p.name';
        const direction = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        query += ` ORDER BY ${sortCol} ${direction}, p."createdAt" DESC`;

        const res = await db.query(query, params);
        return res.rows.map(r => this.formatProduct(r));
    }

    /**
     * Busca um produto por ID e valida a posse pela empresa
     */
    async getById(id, companyId = null) {
        const db = getDatabase();
        if (!db) return null;

        let query = `
            SELECT 
                p.id, 
                p."companyId", 
                c.name as "companyName",
                p.name, 
                p.description, 
                p.price::float, 
                p."costPrice"::float, 
                p."promotionalPrice"::float,
                p.sku, 
                p.brand,
                p.category, 
                p.stock, 
                p."minStock",
                p.unit,
                p."manageStock", 
                p.weight::float,
                p.width::float,
                p.height::float,
                p.length::float,
                p."checkoutUrl",
                COALESCE(p.tags, '[]') as tags,
                p.ean,
                p."imageUrl", 
                COALESCE(p.images, '[]') as images,
                p."isActive", 
                p."createdAt", 
                p."updatedAt"
            FROM products p
            LEFT JOIN companies c ON p."companyId" = c.id
            WHERE p.id = $1
        `;
        const params = [id];

        if (companyId) {
            query += ` AND p."companyId" = $2`;
            params.push(companyId);
        }

        const res = await db.query(query, params);
        if (!res.rows[0]) return null;
        return this.formatProduct(res.rows[0]);
    }

    /**
     * Cria um novo produto estritamente vinculado à empresa (suporta até 5 fotos)
     */
    async create(data, companyId) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados não disponível');

        const {
            name,
            description = '',
            price = 0,
            costPrice = 0,
            promotionalPrice = null,
            sku = '',
            brand = '',
            category = 'Geral',
            stock = 0,
            minStock = 0,
            unit = 'un',
            manageStock = false,
            weight = 0,
            width = 0,
            height = 0,
            length = 0,
            checkoutUrl = '',
            tags = [],
            ean = '',
            imageUrl = '',
            images = [],
            isActive = true
        } = data;

        if (!name || !name.trim()) {
            throw new Error('O nome do produto é obrigatório.');
        }

        if (!companyId) {
            throw new Error('O vínculo com a empresa é obrigatório.');
        }

        // Normalização das fotos (até 5 fotos reais)
        let normalizedImages = Array.isArray(images) ? images : [];
        if (imageUrl && !normalizedImages.includes(imageUrl)) {
            normalizedImages.unshift(imageUrl);
        }
        normalizedImages = normalizedImages.filter(img => typeof img === 'string' && img.trim()).slice(0, 5);
        const primaryImage = normalizedImages[0] || (imageUrl ? imageUrl.trim() : null);

        // Normalização das tags
        const normalizedTags = Array.isArray(tags) 
            ? tags.map(t => String(t).trim()).filter(Boolean)
            : [];

        const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();
        const numPrice = Math.max(0, parseFloat(price) || 0);
        const numCost = Math.max(0, parseFloat(costPrice) || 0);
        const numPromo = (promotionalPrice !== null && promotionalPrice !== undefined && promotionalPrice !== '' && !isNaN(promotionalPrice)) 
            ? Math.max(0, parseFloat(promotionalPrice)) 
            : null;
        const numStock = parseInt(stock, 10) || 0;
        const numMinStock = Math.max(0, parseInt(minStock, 10) || 0);
        const numWeight = Math.max(0, parseFloat(weight) || 0);
        const numWidth = Math.max(0, parseFloat(width) || 0);
        const numHeight = Math.max(0, parseFloat(height) || 0);
        const numLength = Math.max(0, parseFloat(length) || 0);

        const query = `
            INSERT INTO products (
                id, 
                "companyId", 
                name, 
                description, 
                price, 
                "costPrice", 
                "promotionalPrice",
                sku, 
                brand,
                category, 
                stock, 
                "minStock",
                unit,
                "manageStock", 
                weight,
                width,
                height,
                length,
                "checkoutUrl",
                tags,
                ean,
                "imageUrl", 
                images,
                "isActive", 
                "createdAt", 
                "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
            RETURNING *;
        `;

        const values = [
            id,
            companyId,
            name.trim(),
            description ? description.trim() : null,
            numPrice,
            numCost,
            numPromo,
            sku ? sku.trim().toUpperCase() : null,
            brand ? brand.trim() : null,
            category ? category.trim() : 'Geral',
            numStock,
            numMinStock,
            unit ? unit.trim().toLowerCase() : 'un',
            Boolean(manageStock),
            numWeight,
            numWidth,
            numHeight,
            numLength,
            checkoutUrl ? checkoutUrl.trim() : null,
            JSON.stringify(normalizedTags),
            ean ? ean.trim() : null,
            primaryImage,
            JSON.stringify(normalizedImages),
            isActive !== undefined ? Boolean(isActive) : true,
            now,
            now
        ];

        const res = await db.query(query, values);
        return this.formatProduct(res.rows[0]);
    }

    /**
     * Atualiza um produto pertencente à empresa (suporta até 5 fotos)
     */
    async update(id, data, companyId = null) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados não disponível');

        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Produto não encontrado ou você não tem permissão para editá-lo.');
        }

        const {
            name = current.name,
            description = current.description,
            price = current.price,
            costPrice = current.costPrice,
            promotionalPrice = current.promotionalPrice,
            sku = current.sku,
            brand = current.brand,
            category = current.category,
            stock = current.stock,
            minStock = current.minStock,
            unit = current.unit,
            manageStock = current.manageStock,
            weight = current.weight,
            width = current.width,
            height = current.height,
            length = current.length,
            checkoutUrl = current.checkoutUrl,
            tags = current.tags,
            ean = current.ean,
            imageUrl = current.imageUrl,
            images = current.images || [],
            isActive = current.isActive,
            targetCompanyId = null
        } = data;

        // Normalização das fotos (até 5 fotos reais)
        let normalizedImages = Array.isArray(images) ? [...images] : (current.images || []);
        if (imageUrl && !normalizedImages.includes(imageUrl)) {
            normalizedImages.unshift(imageUrl);
        }
        normalizedImages = normalizedImages.filter(img => typeof img === 'string' && img.trim()).slice(0, 5);
        const primaryImage = normalizedImages[0] || (imageUrl ? imageUrl.trim() : null);

        // Normalização das tags
        const normalizedTags = Array.isArray(tags) 
            ? tags.map(t => String(t).trim()).filter(Boolean)
            : (Array.isArray(current.tags) ? current.tags : []);

        const numPrice = Math.max(0, parseFloat(price) || 0);
        const numCost = Math.max(0, parseFloat(costPrice) || 0);
        const numPromo = (promotionalPrice !== null && promotionalPrice !== undefined && promotionalPrice !== '' && !isNaN(promotionalPrice)) 
            ? Math.max(0, parseFloat(promotionalPrice)) 
            : null;
        const numStock = parseInt(stock, 10) || 0;
        const numMinStock = Math.max(0, parseInt(minStock, 10) || 0);
        const numWeight = Math.max(0, parseFloat(weight) || 0);
        const numWidth = Math.max(0, parseFloat(width) || 0);
        const numHeight = Math.max(0, parseFloat(height) || 0);
        const numLength = Math.max(0, parseFloat(length) || 0);
        const now = new Date().toISOString();

        const finalCompanyId = targetCompanyId || current.companyId;

        const query = `
            UPDATE products
            SET 
                "companyId" = $1,
                name = $2,
                description = $3,
                price = $4,
                "costPrice" = $5,
                "promotionalPrice" = $6,
                sku = $7,
                brand = $8,
                category = $9,
                stock = $10,
                "minStock" = $11,
                unit = $12,
                "manageStock" = $13,
                weight = $14,
                width = $15,
                height = $16,
                length = $17,
                "checkoutUrl" = $18,
                tags = $19,
                ean = $20,
                "imageUrl" = $21,
                images = $22,
                "isActive" = $23,
                "updatedAt" = $24
            WHERE id = $25
            RETURNING *;
        `;

        const values = [
            finalCompanyId,
            name.trim(),
            description !== null && description !== undefined ? description.trim() : null,
            numPrice,
            numCost,
            numPromo,
            sku ? sku.trim().toUpperCase() : null,
            brand ? brand.trim() : null,
            category ? category.trim() : 'Geral',
            numStock,
            numMinStock,
            unit ? unit.trim().toLowerCase() : 'un',
            Boolean(manageStock),
            numWeight,
            numWidth,
            numHeight,
            numLength,
            checkoutUrl ? checkoutUrl.trim() : null,
            JSON.stringify(normalizedTags),
            ean ? ean.trim() : null,
            primaryImage,
            JSON.stringify(normalizedImages),
            Boolean(isActive),
            now,
            id
        ];

        const res = await db.query(query, values);
        return this.formatProduct(res.rows[0]);
    }

    /**
     * Deleta um produto
     */
    async delete(id, companyId = null) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados não disponível');

        const current = await this.getById(id, companyId);
        if (!current) {
            return false;
        }

        const query = `DELETE FROM products WHERE id = $1`;
        await db.query(query, [id]);
        return true;
    }

    /**
     * Alterna o status ativo/inativo do produto
     */
    async toggleStatus(id, companyId = null) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados não disponível');

        const current = await this.getById(id, companyId);
        if (!current) {
            throw new Error('Produto não encontrado.');
        }

        const newStatus = !current.isActive;
        const now = new Date().toISOString();

        const query = `
            UPDATE products 
            SET "isActive" = $1, "updatedAt" = $2 
            WHERE id = $3 
            RETURNING *;
        `;
        const res = await db.query(query, [newStatus, now, id]);
        return this.formatProduct(res.rows[0]);
    }

    /**
     * Retorna todas as categorias únicas de produtos da empresa
     */
    async getCategories(companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        let query = `
            SELECT DISTINCT category 
            FROM products 
            WHERE category IS NOT NULL AND category != ''
        `;
        const params = [];

        if (companyId) {
            query += ` AND "companyId" = $1`;
            params.push(companyId);
        }

        query += ` ORDER BY category ASC`;

        const res = await db.query(query, params);
        return res.rows.map(r => r.category);
    }
}

module.exports = new ProductService();
