import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Grid, 
  List, 
  DollarSign, 
  Layers, 
  Archive, 
  Image as ImageIcon, 
  RefreshCw, 
  TrendingUp, 
  Tag, 
  Barcode, 
  Copy,
  ChevronDown,
  Upload,
  Camera,
  Star,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Percent,
  AlertTriangle,
  Scale,
  Box,
  Flame,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const DEFAULT_CATEGORIES = [
  'Geral',
  'Planos & Serviços',
  'Mensageria',
  'Serviços',
  'Produtos Físicos',
  'Consultoria',
  'Cursos & Treinamentos'
];

const POPULAR_TAGS = [
  'Mais Vendido',
  'Lançamento',
  'Promoção',
  'Frete Grátis',
  'Destaque',
  'Pronta Entrega',
  'Black Friday',
  'Oferta Relâmpago'
];

const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'cm', label: 'Centímetro (cm)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'kit', label: 'Kit / Combo' }
];

export default function ProductsView() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Estados de dados
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => isSuperAdmin ? 'all' : (user?.companyId || 'company_default'));
  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);

  // Filtros & Visualização
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');

  // Modais e formulários
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Aba ativa dentro do modal de produto
  const [activeModalTab, setActiveModalTab] = useState('general'); // 'general' | 'pricing' | 'inventory' | 'tags'
  const [tagInput, setTagInput] = useState('');

  // Lightbox para ver foto ampliada
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    costPrice: '',
    promotionalPrice: '',
    sku: '',
    brand: '',
    category: 'Geral',
    customCategory: '',
    stock: '0',
    minStock: '5',
    unit: 'un',
    manageStock: false,
    weight: '',
    width: '',
    height: '',
    length: '',
    checkoutUrl: '',
    tags: [],
    ean: '',
    images: [], // Até 5 fotos reais
    isActive: true,
    companyId: user?.companyId || 'company_default'
  });

  const showToast = useCallback((text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Carregar lista de empresas se for Superadmin
  useEffect(() => {
    if (isSuperAdmin && api.getCompanies) {
      api.getCompanies().then(res => {
        if (Array.isArray(res)) {
          setCompanies(res);
        }
      }).catch(err => console.error('Erro ao buscar empresas:', err));
    }
  }, [isSuperAdmin]);

  // Carregar produtos
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCompanyId && selectedCompanyId !== 'all') {
        params.companyId = selectedCompanyId;
      } else if (isSuperAdmin && selectedCompanyId === 'all') {
        params.companyId = 'all';
      }
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory !== 'Todas') params.category = selectedCategory;
      if (statusFilter === 'active') params.isActive = true;
      if (statusFilter === 'inactive') params.isActive = false;
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;

      const res = await api.getProducts(params);
      if (res && Array.isArray(res.products)) {
        setProducts(res.products);
        
        const uniqueCats = Array.from(new Set([
          ...DEFAULT_CATEGORIES,
          ...res.products.map(p => p.category).filter(Boolean)
        ]));
        setCategoriesList(uniqueCats);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      showToast('Erro ao carregar lista de produtos', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, searchTerm, selectedCategory, statusFilter, sortBy, sortOrder, isSuperAdmin, showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.isActive).length;
    const lowStock = products.filter(p => p.manageStock && p.stock <= (p.minStock !== undefined && p.minStock !== null ? p.minStock : 5)).length;
    const totalInventoryValue = products.reduce((acc, p) => {
      const price = parseFloat(p.price) || 0;
      const stock = p.manageStock ? (parseInt(p.stock, 10) || 0) : 1;
      return acc + (price * stock);
    }, 0);

    return { total, active, lowStock, totalInventoryValue };
  }, [products]);

  // Abertura do Modal de Criação / Edição
  const handleOpenModal = (prod = null) => {
    setActiveModalTab('general');
    setTagInput('');
    if (prod) {
      setEditingProduct(prod);
      const productImages = Array.isArray(prod.images) && prod.images.length > 0 
        ? prod.images 
        : (prod.imageUrl ? [prod.imageUrl] : []);

      setFormData({
        name: prod.name || '',
        description: prod.description || '',
        price: prod.price !== undefined && prod.price !== null ? String(prod.price) : '',
        costPrice: prod.costPrice !== undefined && prod.costPrice !== null ? String(prod.costPrice) : '',
        promotionalPrice: prod.promotionalPrice !== undefined && prod.promotionalPrice !== null ? String(prod.promotionalPrice) : '',
        sku: prod.sku || '',
        brand: prod.brand || '',
        category: prod.category || 'Geral',
        customCategory: '',
        stock: prod.stock !== undefined && prod.stock !== null ? String(prod.stock) : '0',
        minStock: prod.minStock !== undefined && prod.minStock !== null ? String(prod.minStock) : '5',
        unit: prod.unit || 'un',
        manageStock: Boolean(prod.manageStock),
        weight: prod.weight !== undefined && prod.weight !== null ? String(prod.weight) : '',
        width: prod.width !== undefined && prod.width !== null ? String(prod.width) : '',
        height: prod.height !== undefined && prod.height !== null ? String(prod.height) : '',
        length: prod.length !== undefined && prod.length !== null ? String(prod.length) : '',
        checkoutUrl: prod.checkoutUrl || '',
        tags: Array.isArray(prod.tags) ? [...prod.tags] : [],
        ean: prod.ean || '',
        images: productImages.slice(0, 5),
        isActive: Boolean(prod.isActive),
        companyId: prod.companyId || (user?.companyId || 'company_default')
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        costPrice: '',
        promotionalPrice: '',
        sku: '',
        brand: '',
        category: 'Geral',
        customCategory: '',
        stock: '0',
        minStock: '5',
        unit: 'un',
        manageStock: false,
        weight: '',
        width: '',
        height: '',
        length: '',
        checkoutUrl: '',
        tags: [],
        ean: '',
        images: [],
        isActive: true,
        companyId: (selectedCompanyId && selectedCompanyId !== 'all') ? selectedCompanyId : (user?.companyId || 'company_default')
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setActiveModalTab('general');
    setTagInput('');
  };

  // Gerenciamento de Tags
  const handleAddTag = (tagToAdd) => {
    const clean = (tagToAdd || tagInput).trim();
    if (!clean) return;
    if (formData.tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      showToast('Esta tag já foi adicionada.', 'error');
      return;
    }
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, clean]
    }));
    setTagInput('');
  };

  const handleRemoveTag = (tagIndex) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, idx) => idx !== tagIndex)
    }));
  };

  // Copiar Link de Checkout / Pagamento
  const handleCopyCheckoutUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast('Link de pagamento / checkout copiado com sucesso!');
  };

  // Upload Real de Fotos (até 5 fotos)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentImages = formData.images || [];
    const availableSlots = 5 - currentImages.length;

    if (availableSlots <= 0) {
      showToast('Limite máximo de 5 fotos atingido para este produto.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToUpload = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      showToast(`Você selecionou ${files.length} fotos. Apenas ${availableSlots} foram adicionadas para respeitar o limite de 5.`);
    }

    try {
      setIsUploadingPhoto(true);
      const uploadedUrls = [];

      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) {
          showToast(`O arquivo ${file.name} não é uma imagem válida.`, 'error');
          continue;
        }

        const data = new FormData();
        data.append('file', file);
        const res = await api.uploadFile(data);
        if (res && (res.fileUrl || res.url)) {
          uploadedUrls.push(res.fileUrl || res.url);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), ...uploadedUrls].slice(0, 5)
        }));
        showToast(`${uploadedUrls.length} foto(s) enviada(s) com sucesso!`);
      }
    } catch (error) {
      console.error('Erro no upload de foto:', error);
      showToast('Erro ao realizar upload da foto. Tente novamente.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remover foto específica
  const handleRemovePhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Definir foto como Capa (mover para a primeira posição)
  const handleSetAsCover = (index) => {
    if (index === 0) return;
    setFormData(prev => {
      const copy = [...prev.images];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return { ...prev, images: copy };
    });
    showToast('Foto definida como capa principal!');
  };

  // Salvar Produto (Criar ou Atualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('O nome do produto é obrigatório.', 'error');
      return;
    }

    const targetCompany = formData.companyId || (user?.companyId || 'company_default');
    if (!targetCompany) {
      showToast('Selecione uma empresa válida para vincular o produto.', 'error');
      return;
    }

    const finalCategory = formData.category === '__custom__' 
      ? (formData.customCategory.trim() || 'Geral')
      : formData.category;

    const finalImages = (formData.images || []).slice(0, 5);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: parseFloat(formData.price) || 0,
      costPrice: parseFloat(formData.costPrice) || 0,
      promotionalPrice: formData.promotionalPrice !== '' && !isNaN(formData.promotionalPrice) ? parseFloat(formData.promotionalPrice) : null,
      sku: formData.sku.trim(),
      brand: formData.brand.trim(),
      category: finalCategory,
      stock: parseInt(formData.stock, 10) || 0,
      minStock: parseInt(formData.minStock, 10) || 0,
      unit: formData.unit || 'un',
      manageStock: Boolean(formData.manageStock),
      weight: parseFloat(formData.weight) || 0,
      width: parseFloat(formData.width) || 0,
      height: parseFloat(formData.height) || 0,
      length: parseFloat(formData.length) || 0,
      checkoutUrl: formData.checkoutUrl.trim(),
      tags: formData.tags || [],
      ean: formData.ean.trim(),
      images: finalImages,
      imageUrl: finalImages[0] || null,
      isActive: Boolean(formData.isActive),
      companyId: targetCompany,
      targetCompanyId: targetCompany
    };

    try {
      setIsSubmitting(true);
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showToast('Produto atualizado com sucesso!');
      } else {
        await api.createProduct(payload);
        showToast('Produto cadastrado com sucesso!');
      }
      handleCloseModal();
      fetchProducts();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      showToast(error.message || 'Erro ao salvar produto', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar Status Ativo/Inativo
  const handleToggleStatus = async (prod) => {
    try {
      await api.toggleProductStatus(prod.id);
      showToast(`Produto ${prod.isActive ? 'desativado' : 'ativado'} com sucesso!`);
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, isActive: !p.isActive } : p));
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      showToast('Erro ao atualizar status', 'error');
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async (id) => {
    try {
      await api.deleteProduct(id);
      showToast('Produto excluído com sucesso!');
      setDeleteConfirmId(null);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      showToast('Erro ao excluir produto', 'error');
    }
  };

  // Duplicar Produto
  const handleDuplicateProduct = async (prod) => {
    try {
      const copyPayload = {
        name: `${prod.name} (Cópia)`,
        description: prod.description,
        price: prod.price,
        costPrice: prod.costPrice,
        promotionalPrice: prod.promotionalPrice,
        sku: prod.sku ? `${prod.sku}-COP` : '',
        brand: prod.brand,
        category: prod.category,
        stock: prod.stock,
        minStock: prod.minStock,
        unit: prod.unit,
        manageStock: prod.manageStock,
        weight: prod.weight,
        width: prod.width,
        height: prod.height,
        length: prod.length,
        checkoutUrl: prod.checkoutUrl,
        tags: prod.tags || [],
        ean: prod.ean ? `${prod.ean}-COP` : '',
        images: prod.images || (prod.imageUrl ? [prod.imageUrl] : []),
        imageUrl: prod.imageUrl,
        isActive: true,
        companyId: prod.companyId
      };
      await api.createProduct(copyPayload);
      showToast('Cópia do produto criada com sucesso!');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao duplicar produto:', error);
      showToast('Erro ao duplicar produto', 'error');
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflowY: 'auto',
      padding: '24px 32px',
      boxSizing: 'border-box'
    }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '28px',
          zIndex: 99999,
          padding: '12px 20px',
          borderRadius: '12px',
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Superior */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <Package size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Produtos & Catálogo
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
                Gerencie catálogo de produtos com galeria de até 5 fotos reais, estoque e preços vinculados à sua empresa.
              </p>
            </div>
          </div>
        </div>

        {/* Ações do Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Seletor de Empresa para Superadmin */}
          {isSuperAdmin && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#1e293b',
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Building2 size={16} color="#818cf8" />
              <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Empresa:</span>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all" style={{ backgroundColor: '#1e293b' }}>Todas as Empresas (Visão Global)</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: '#1e293b' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => fetchProducts()}
            title="Recarregar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={17} />
          </button>

          <button
            onClick={() => handleOpenModal()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              transition: 'transform 0.15s, background-color 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
          >
            <Plus size={18} />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas / Estatísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Package size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total de Itens
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, marginTop: '2px' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34d399'
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ativos no Catálogo
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, marginTop: '2px', color: '#34d399' }}>
              {stats.active}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <Archive size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Estoque Baixo
            </span>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, marginTop: '2px', color: '#fbbf24' }}>
              {stats.lowStock}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Valor em Catálogo
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px', color: '#38bdf8' }}>
              {formatCurrency(stats.totalInventoryValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros, Pesquisa e Modos de Exibição */}
      <div style={{
        backgroundColor: '#131b2e',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '14px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Campo de Busca */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#1e293b',
          borderRadius: '10px',
          padding: '8px 14px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          minWidth: '260px',
          flex: '1 1 280px'
        }}>
          <Search size={17} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU, categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.88rem',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filtros em linha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Categoria:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.84rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="Todas">Todas as Categorias</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '3px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                backgroundColor: statusFilter === 'all' ? '#6366f1' : 'transparent',
                color: statusFilter === 'all' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              style={{
                backgroundColor: statusFilter === 'active' ? '#10b981' : 'transparent',
                color: statusFilter === 'active' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              style={{
                backgroundColor: statusFilter === 'inactive' ? '#ef4444' : 'transparent',
                color: statusFilter === 'inactive' ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Inativos
            </button>
          </div>

          <div style={{
            display: 'flex',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '3px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade"
              style={{
                backgroundColor: viewMode === 'grid' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                color: viewMode === 'grid' ? '#818cf8' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Visualização em Tabela"
              style={{
                backgroundColor: viewMode === 'table' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                color: viewMode === 'table' ? '#818cf8' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Produtos */}
      {loading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          color: '#94a3b8',
          minHeight: '300px'
        }}>
          <RefreshCw size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Carregando produtos da empresa...</span>
        </div>
      ) : products.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#131b2e',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: '320px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            marginBottom: '16px'
          }}>
            <Package size={32} />
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 600 }}>
            Nenhum produto encontrado
          </h3>
          <p style={{ margin: '0 0 20px 0', color: '#94a3b8', maxWidth: '420px', fontSize: '0.9rem' }}>
            {searchTerm || selectedCategory !== 'Todas' 
              ? 'Não encontramos nenhum produto com os filtros atuais. Tente buscar por outros termos.'
              : 'Cadastre o catálogo de produtos com até 5 fotos reais para disponibilizar aos seus atendentes e robôs de atendimento.'}
          </p>
          <button
            onClick={() => handleOpenModal()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            <span>Cadastrar Primeiro Produto</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Visualização em GRADE / CARDS */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '20px'
        }}>
          {products.map(prod => {
            const prodImages = Array.isArray(prod.images) && prod.images.length > 0 
              ? prod.images 
              : (prod.imageUrl ? [prod.imageUrl] : []);
            const coverImage = prodImages[0] || null;
            const hasDiscount = prod.promotionalPrice !== null && prod.promotionalPrice !== undefined && parseFloat(prod.promotionalPrice) > 0 && parseFloat(prod.promotionalPrice) < parseFloat(prod.price);
            const discountPercent = hasDiscount ? Math.round(((parseFloat(prod.price) - parseFloat(prod.promotionalPrice)) / parseFloat(prod.price)) * 100) : 0;
            const isLowStock = prod.manageStock && parseInt(prod.stock, 10) <= (prod.minStock !== undefined && prod.minStock !== null ? parseInt(prod.minStock, 10) : 5);

            return (
              <div
                key={prod.id}
                style={{
                  backgroundColor: '#131b2e',
                  border: prod.isActive 
                    ? '1px solid rgba(255, 255, 255, 0.08)' 
                    : '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  opacity: prod.isActive ? 1 : 0.75
                }}
              >
                {/* Topo do Card: Galeria de Fotos */}
                <div style={{
                  height: '175px',
                  backgroundColor: '#1e293b',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={prod.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => setPreviewPhotoUrl(coverImage)}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#64748b'
                    }}>
                      <Camera size={36} opacity={0.4} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Sem Fotos</span>
                    </div>
                  )}

                  {/* Badge de Contagem de Fotos */}
                  {prodImages.length > 0 && (
                    <div 
                      onClick={() => setPreviewPhotoUrl(coverImage)}
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(6px)',
                        color: '#f8fafc',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={12} color="#38bdf8" />
                      <span>{prodImages.length} {prodImages.length === 1 ? 'foto' : 'fotos'}</span>
                    </div>
                  )}

                  {/* Badge de Categoria */}
                  <span style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(6px)',
                    color: '#93c5fd',
                    border: '1px solid rgba(147, 197, 253, 0.25)',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 600
                  }}>
                    {prod.category || 'Geral'}
                  </span>

                  {/* Badge de Oferta / Promoção */}
                  {hasDiscount && (
                    <div style={{
                      position: 'absolute',
                      top: '40px',
                      left: '12px',
                      background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                    }}>
                      <Flame size={11} />
                      <span>-{discountPercent}% OFF</span>
                    </div>
                  )}

                  {/* Badge de Empresa Associada */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(6px)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Building2 size={12} color="#818cf8" />
                    <span>{prod.companyName || 'Empresa Principal'}</span>
                  </div>

                  {/* Badge de Status */}
                  <span style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    backgroundColor: prod.isActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em'
                  }}>
                    {prod.isActive ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>

                {/* Mini-Galeria de Miniaturas (se houver mais de 1 foto) */}
                {prodImages.length > 1 && (
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#0c1322',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    overflowX: 'auto'
                  }}>
                    {prodImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewPhotoUrl(imgUrl)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: idx === 0 ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                          flexShrink: 0
                        }}
                        title={idx === 0 ? 'Capa Principal' : `Foto ${idx + 1}`}
                      >
                        <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Corpo do Card */}
                <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {prod.brand && (
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#818cf8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '2px'
                    }}>
                      {prod.brand}
                    </span>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      lineHeight: 1.3
                    }}>
                      {prod.name}
                    </h4>
                  </div>

                  {/* SKU e Código de Barras / EAN */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                    {prod.sku && (
                      <span style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: '#94a3b8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        fontWeight: 600
                      }}>
                        SKU: {prod.sku}
                      </span>
                    )}
                    {prod.ean && (
                      <span style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: '#cbd5e1',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Barcode size={10} /> {prod.ean}
                      </span>
                    )}
                  </div>

                  {prod.description && (
                    <p style={{
                      margin: '8px 0 10px 0',
                      fontSize: '0.84rem',
                      color: '#94a3b8',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {prod.description}
                    </p>
                  )}

                  {/* Tags do Produto */}
                  {Array.isArray(prod.tags) && prod.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      {prod.tags.slice(0, 3).map((t, idx) => (
                        <span key={idx} style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          fontSize: '0.66rem',
                          fontWeight: 600
                        }}>
                          #{t}
                        </span>
                      ))}
                      {prod.tags.length > 3 && (
                        <span style={{ fontSize: '0.66rem', color: '#64748b', alignSelf: 'center' }}>
                          +{prod.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bloco de Preços e Estoque */}
                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                          {hasDiscount ? 'De / Por' : 'Preço de Venda'}
                        </span>
                        {hasDiscount ? (
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                              {formatCurrency(prod.price)}
                            </span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                              {formatCurrency(prod.promotionalPrice)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                            {formatCurrency(prod.price)}
                          </span>
                        )}
                      </div>

                      {prod.manageStock && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Estoque</span>
                          <span style={{
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: isLowStock ? '#f87171' : '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px'
                          }}>
                            {isLowStock && <AlertTriangle size={13} color="#f87171" />}
                            <span>{prod.stock} {prod.unit || 'un'}</span>
                          </span>
                          {isLowStock && (
                            <span style={{ fontSize: '0.66rem', color: '#f87171', display: 'block', fontWeight: 600 }}>
                              Reposição (Mín: {prod.minStock || 5})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botão de Checkout se informado */}
                    {prod.checkoutUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyCheckoutUrl(prod.checkoutUrl)}
                        title="Copiar link de checkout/pagamento"
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          backgroundColor: 'rgba(99, 102, 241, 0.08)',
                          border: '1px dashed rgba(99, 102, 241, 0.35)',
                          color: '#a5b4fc',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.18)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)'}
                      >
                        <ExternalLink size={12} />
                        <span>Copiar Link de Compra</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Rodapé de Ações do Card */}
                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '10px 18px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <button
                    onClick={() => handleToggleStatus(prod)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: prod.isActive ? '#94a3b8' : '#34d399',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {prod.isActive ? 'Desativar' : 'Ativar Produto'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleDuplicateProduct(prod)}
                      title="Duplicar Produto"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px'
                      }}
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      onClick={() => handleOpenModal(prod)}
                      title="Editar Produto"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#818cf8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px'
                      }}
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(prod.id)}
                      title="Excluir Produto"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em TABELA */
        <div style={{
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                <th style={{ padding: '14px 18px' }}>Produto</th>
                <th style={{ padding: '14px 18px' }}>Fotos</th>
                <th style={{ padding: '14px 18px' }}>SKU / EAN</th>
                <th style={{ padding: '14px 18px' }}>Categoria</th>
                <th style={{ padding: '14px 18px' }}>Empresa</th>
                <th style={{ padding: '14px 18px' }}>Preço</th>
                <th style={{ padding: '14px 18px' }}>Estoque</th>
                <th style={{ padding: '14px 18px' }}>Checkout</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map(prod => {
                const prodImages = Array.isArray(prod.images) && prod.images.length > 0 
                  ? prod.images 
                  : (prod.imageUrl ? [prod.imageUrl] : []);
                const coverImage = prodImages[0] || null;
                const hasDiscount = prod.promotionalPrice !== null && prod.promotionalPrice !== undefined && parseFloat(prod.promotionalPrice) > 0 && parseFloat(prod.promotionalPrice) < parseFloat(prod.price);
                const isLowStock = prod.manageStock && parseInt(prod.stock, 10) <= (prod.minStock !== undefined && prod.minStock !== null ? parseInt(prod.minStock, 10) : 5);

                return (
                  <tr
                    key={prod.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background-color 0.1s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          onClick={() => coverImage && setPreviewPhotoUrl(coverImage)}
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            backgroundColor: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            overflow: 'hidden',
                            flexShrink: 0,
                            cursor: coverImage ? 'pointer' : 'default'
                          }}
                        >
                          {coverImage ? (
                            <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={18} />
                          )}
                        </div>
                        <div>
                          {prod.brand && (
                            <span style={{ fontSize: '0.68rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                              {prod.brand}
                            </span>
                          )}
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                            {prod.name}
                          </div>
                          {prod.description && (
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {prod.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Camera size={14} color="#818cf8" />
                        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
                          {prodImages.length}/5
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '0.84rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                      <div>{prod.sku || '-'}</div>
                      {prod.ean && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>EAN: {prod.ean}</div>}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: '#818cf8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600
                      }}>
                        {prod.category || 'Geral'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Building2 size={13} color="#818cf8" />
                        <span>{prod.companyName || 'Empresa Principal'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '0.92rem' }}>
                      {hasDiscount ? (
                        <div>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                            {formatCurrency(prod.price)}
                          </div>
                          <div style={{ fontWeight: 800, color: '#34d399' }}>
                            {formatCurrency(prod.promotionalPrice)}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700, color: '#34d399' }}>
                          {formatCurrency(prod.price)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '0.86rem' }}>
                      {prod.manageStock ? (
                        <div>
                          <span style={{
                            color: isLowStock ? '#f87171' : '#38bdf8',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {isLowStock && <AlertTriangle size={12} color="#f87171" />}
                            {prod.stock} {prod.unit || 'un'}
                          </span>
                          {isLowStock && (
                            <span style={{ fontSize: '0.68rem', color: '#f87171', display: 'block' }}>
                              Mín: {prod.minStock || 5}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>Infinito</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {prod.checkoutUrl ? (
                        <button
                          type="button"
                          onClick={() => handleCopyCheckoutUrl(prod.checkoutUrl)}
                          title="Copiar link"
                          style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            color: '#818cf8',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ExternalLink size={12} />
                          <span>Link</span>
                        </button>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        backgroundColor: prod.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: prod.isActive ? '#34d399' : '#f87171',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700
                      }}>
                        {prod.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => handleDuplicateProduct(prod)}
                          title="Duplicar"
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(prod)}
                          title="Editar"
                          style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '4px' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(prod.id)}
                          title="Excluir"
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PRODUTO EM ABAS MODERNAS */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#131b2e',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '760px',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden'
          }}>
            {/* Cabeçalho do Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 28px 16px 28px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8'
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.28rem', fontWeight: 700 }}>
                    {editingProduct ? 'Editar Produto / Serviço' : 'Novo Produto / Serviço'}
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    {editingProduct ? 'Configure valores, fotos, estoque e informações de vendas' : 'Cadastre seu produto ou serviço com catálogo completo'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Navegação por Abas Modernas */}
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '12px 28px 0 28px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              overflowX: 'auto'
            }}>
              {[
                { id: 'general', label: 'Geral & Fotos', icon: Package },
                { id: 'pricing', label: 'Preços & Vendas', icon: DollarSign },
                { id: 'inventory', label: 'Estoque & Logística', icon: Archive },
                { id: 'tags', label: 'Tags & Busca', icon: Tag }
              ].map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveModalTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #6366f1' : '3px solid transparent',
                      backgroundColor: 'transparent',
                      color: isActive ? '#f8fafc' : '#94a3b8',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <TabIcon size={16} color={isActive ? '#818cf8' : '#94a3b8'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo com Scroll do Formulário */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>

                {/* ABA 1: DADOS GERAIS & FOTOS */}
                {activeModalTab === 'general' && (
                  <>
                    {/* Se for Superadmin: Seleção Obrigatória de Empresa */}
                    {isSuperAdmin && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#93c5fd', marginBottom: '6px' }}>
                          Empresa Vinculada *
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(147, 197, 253, 0.3)',
                          borderRadius: '10px',
                          padding: '8px 14px'
                        }}>
                          <Building2 size={16} color="#93c5fd" />
                          <select
                            value={formData.companyId}
                            onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#f8fafc',
                              fontSize: '0.88rem',
                              width: '100%',
                              fontWeight: 600
                            }}
                            required
                          >
                            {companies.map(c => (
                              <option key={c.id} value={c.id} style={{ backgroundColor: '#1e293b' }}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Galeria de Fotos (Até 5 Fotos Reais) */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Camera size={16} color="#818cf8" />
                            <span>Galeria de Fotos (Até 5 fotos)</span>
                          </label>
                          <span style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                            A primeira foto é a capa principal do produto no catálogo e chat.
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          backgroundColor: formData.images.length === 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                          color: formData.images.length === 5 ? '#f87171' : '#818cf8',
                          padding: '3px 10px',
                          borderRadius: '8px'
                        }}>
                          {formData.images.length}/5 fotos
                        </span>
                      </div>

                      {/* Grade de Miniaturas das Fotos */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '10px',
                        marginBottom: '12px'
                      }}>
                        {formData.images.map((imgUrl, index) => (
                          <div
                            key={index}
                            style={{
                              position: 'relative',
                              aspectRatio: '1/1',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: index === 0 ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                              backgroundColor: '#1e293b'
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Foto ${index + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />

                            {index === 0 && (
                              <div style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                backgroundColor: '#6366f1',
                                color: '#fff',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                <Star size={9} />
                                <span>CAPA</span>
                              </div>
                            )}

                            <div style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '4px',
                              display: 'flex',
                              gap: '4px'
                            }}>
                              {index !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleSetAsCover(index)}
                                  title="Definir como capa principal"
                                  style={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                    border: 'none',
                                    color: '#fbbf24',
                                    borderRadius: '4px',
                                    padding: '3px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Star size={11} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index)}
                                title="Remover foto"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.85)',
                                  border: 'none',
                                  color: '#fff',
                                  borderRadius: '4px',
                                  padding: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {formData.images.length < 5 && (
                          <div
                            onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}
                            style={{
                              aspectRatio: '1/1',
                              borderRadius: '10px',
                              border: '2px dashed rgba(99, 102, 241, 0.4)',
                              backgroundColor: 'rgba(99, 102, 241, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              cursor: isUploadingPhoto ? 'wait' : 'pointer',
                              color: '#818cf8',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            {isUploadingPhoto ? (
                              <RefreshCw size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <>
                                <Upload size={18} />
                                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>+ Foto</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        multiple
                        style={{ display: 'none' }}
                      />

                      <button
                        type="button"
                        disabled={formData.images.length >= 5 || isUploadingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: formData.images.length >= 5 ? '#1e293b' : 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: formData.images.length >= 5 ? '#64748b' : '#818cf8',
                          borderRadius: '8px',
                          padding: '7px 14px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: formData.images.length >= 5 || isUploadingPhoto ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <Upload size={13} />
                        <span>Carregar Fotos</span>
                      </button>
                    </div>

                    {/* Nome do Produto */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Nome do Produto / Serviço *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Teclado Mecânico RGB Pro, Licença Zeplyn..."
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        style={{
                          width: '100%',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          color: '#f8fafc',
                          fontSize: '0.9rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        required
                      />
                    </div>

                    {/* Linha: Marca & Categoria */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Marca / Fabricante
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Apple, Samsung, Zeplyn Tech..."
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Categoria
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.88rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        >
                          {categoriesList.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="__custom__">+ Nova Categoria...</option>
                        </select>
                      </div>
                    </div>

                    {formData.category === '__custom__' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#818cf8', marginBottom: '6px' }}>
                          Nome da Nova Categoria
                        </label>
                        <input
                          type="text"
                          placeholder="Digite a nova categoria..."
                          value={formData.customCategory}
                          onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(129, 140, 248, 0.4)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          required
                        />
                      </div>
                    )}

                    {/* Linha: SKU e Código de Barras (EAN / GTIN) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Código SKU (Referência Interna)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: ZEP-001"
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Código de Barras (EAN / GTIN)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 7891234567890"
                          value={formData.ean}
                          onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    {/* Descrição */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Descrição Detalhada
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Descreva detalhes, especificações ou diferenciais que serão usados no chat..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{
                          width: '100%',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          color: '#f8fafc',
                          fontSize: '0.88rem',
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Status Ativo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id="isActiveCheck"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <label htmlFor="isActiveCheck" style={{ fontSize: '0.86rem', color: '#f8fafc', cursor: 'pointer', fontWeight: 500 }}>
                        Produto Ativo (visível no catálogo e para atendentes no LiveChat)
                      </label>
                    </div>
                  </>
                )}

                {/* ABA 2: PREÇOS & VENDAS */}
                {activeModalTab === 'pricing' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {/* Preço de Venda */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Preço de Venda (R$) *
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '8px 14px'
                        }}>
                          <span style={{ color: '#34d399', fontWeight: 700, marginRight: '6px' }}>R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#f8fafc',
                              fontSize: '0.95rem',
                              fontWeight: 600
                            }}
                            required
                          />
                        </div>
                      </div>

                      {/* Preço Promocional */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                          Preço Promocional / Oferta (R$)
                        </label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '10px',
                          padding: '8px 14px'
                        }}>
                          <span style={{ color: '#f97316', fontWeight: 700, marginRight: '6px' }}>R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Deixe em branco se não houver"
                            value={formData.promotionalPrice}
                            onChange={(e) => setFormData({ ...formData, promotionalPrice: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#f8fafc',
                              fontSize: '0.95rem',
                              fontWeight: 600
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Feedback Dinâmico de Desconto */}
                    {(() => {
                      const pPrice = parseFloat(formData.price) || 0;
                      const pPromo = parseFloat(formData.promotionalPrice) || 0;
                      if (pPrice > 0 && pPromo > 0 && pPromo < pPrice) {
                        const discount = Math.round(((pPrice - pPromo) / pPrice) * 100);
                        const economy = pPrice - pPromo;
                        return (
                          <div style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: '#fca5a5'
                          }}>
                            <Flame size={18} color="#ef4444" />
                            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                              Oferta ativa! <strong>{discount}% de desconto</strong> (Economia de {formatCurrency(economy)} para o comprador).
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Preço de Custo */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Preço de Custo (R$)
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        maxWidth: '340px'
                      }}>
                        <span style={{ color: '#94a3b8', fontWeight: 700, marginRight: '6px' }}>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={formData.costPrice}
                          onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#f8fafc',
                            fontSize: '0.95rem',
                            fontWeight: 600
                          }}
                        />
                      </div>
                    </div>

                    {/* Indicador de Margem de Lucro */}
                    {(() => {
                      const cost = parseFloat(formData.costPrice) || 0;
                      const sell = parseFloat(formData.promotionalPrice) || parseFloat(formData.price) || 0;
                      if (cost > 0 && sell > 0) {
                        const profit = sell - cost;
                        const marginPercent = Math.round((profit / sell) * 100);
                        const isProfitable = profit > 0;
                        return (
                          <div style={{
                            backgroundColor: isProfitable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${isProfitable ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                            borderRadius: '10px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            color: isProfitable ? '#6ee7b7' : '#fca5a5'
                          }}>
                            <TrendingUp size={18} color={isProfitable ? '#10b981' : '#ef4444'} />
                            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                              Lucro Bruto estimado: <strong>{formatCurrency(profit)}</strong> | Margem: <strong>{marginPercent}%</strong>
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Link de Pagamento / Checkout / Loja Externa */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Link de Pagamento / Checkout Online
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '10px',
                        padding: '8px 14px'
                      }}>
                        <Globe size={16} color="#818cf8" />
                        <input
                          type="url"
                          placeholder="https://seusite.com.br/checkout/produto-123 ou link Stripe/MercadoPago"
                          value={formData.checkoutUrl}
                          onChange={(e) => setFormData({ ...formData, checkoutUrl: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#f8fafc',
                            fontSize: '0.88rem'
                          }}
                        />
                        {formData.checkoutUrl && (
                          <a
                            href={formData.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#818cf8', display: 'flex', alignItems: 'center' }}
                            title="Testar link em nova aba"
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Ao enviar o produto no LiveChat / WhatsApp, o link é enviado para o cliente fechar a compra na hora.
                      </span>
                    </div>
                  </>
                )}

                {/* ABA 3: ESTOQUE & LOGÍSTICA */}
                {activeModalTab === 'inventory' && (
                  <>
                    {/* Toggle Controlar Estoque */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                            Controlar Estoque deste Produto
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                            Ative para monitorar contagem física e emitir avisos de reposição automática.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.manageStock}
                          onChange={(e) => setFormData({ ...formData, manageStock: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                        />
                      </div>

                      {formData.manageStock && (
                        <div style={{
                          marginTop: '16px',
                          paddingTop: '14px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '14px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                              Estoque Atual:
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.stock}
                              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                              style={{
                                width: '100%',
                                backgroundColor: '#1e293b',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#f8fafc',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                              Estoque Mínimo (Alerta):
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.minStock}
                              onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                              style={{
                                width: '100%',
                                backgroundColor: '#1e293b',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#f8fafc',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                              Unidade de Medida:
                            </label>
                            <select
                              value={formData.unit}
                              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                              style={{
                                width: '100%',
                                backgroundColor: '#1e293b',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#f8fafc',
                                fontSize: '0.88rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            >
                              {UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dimensões e Peso para Frete */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Box size={16} color="#818cf8" />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                          Dimensões e Peso (Cálculo de Frete / Logística)
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                            Peso (kg)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="Ex: 0.500"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e293b',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              color: '#f8fafc',
                              fontSize: '0.88rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                            Comprimento (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Ex: 20"
                            value={formData.length}
                            onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e293b',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              color: '#f8fafc',
                              fontSize: '0.88rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                            Largura (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Ex: 15"
                            value={formData.width}
                            onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e293b',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              color: '#f8fafc',
                              fontSize: '0.88rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                            Altura (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Ex: 10"
                            value={formData.height}
                            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e293b',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              color: '#f8fafc',
                              fontSize: '0.88rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ABA 4: TAGS & BUSCA */}
                {activeModalTab === 'tags' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        Adicionar Tags e Palavras-chave
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Digite uma tag (ex: lançamento, sem açúcar, pronta entrega)..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          style={{
                            flex: 1,
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.88rem',
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTag()}
                          style={{
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            borderRadius: '10px',
                            padding: '0 18px',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                          }}
                        >
                          + Adicionar
                        </button>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Pressione Enter para adicionar rapidamente cada palavra-chave.
                      </span>
                    </div>

                    {/* Sugestões de Tags Populares */}
                    <div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                        Sugestões rápidas de tags (clique para incluir):
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {POPULAR_TAGS.map(pt => {
                          const isAlreadyAdded = formData.tags.some(t => t.toLowerCase() === pt.toLowerCase());
                          return (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => !isAlreadyAdded && handleAddTag(pt)}
                              disabled={isAlreadyAdded}
                              style={{
                                backgroundColor: isAlreadyAdded ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: isAlreadyAdded ? '#64748b' : '#cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.74rem',
                                cursor: isAlreadyAdded ? 'default' : 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              + {pt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags Atribuídas */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '16px',
                      minHeight: '100px'
                    }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '10px' }}>
                        Tags cadastradas para este produto ({formData.tags.length}):
                      </span>

                      {formData.tags.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                          Nenhuma tag atribuída até o momento.
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {formData.tags.map((t, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: '#a5b4fc',
                                borderRadius: '8px',
                                padding: '4px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }}
                            >
                              <span>#{t}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Botões do Rodapé do Modal */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 28px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(15, 23, 42, 0.5)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#94a3b8',
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontWeight: 600,
                      fontSize: '0.86rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploadingPhoto}
                    style={{
                      backgroundColor: '#6366f1',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '10px 24px',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: (isSubmitting || isUploadingPhoto) ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSubmitting && <RefreshCw size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} />}
                    <span>{editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX / PREVIEW DE FOTO AMPLIADA */}
      {previewPhotoUrl && (
        <div 
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '24px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Visualização ampliada"
              style={{
                maxWidth: '85vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#131b2e',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxSizing: 'border-box',
            textAlign: 'center'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              margin: '0 auto 16px auto'
            }}>
              <Trash2 size={26} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>
              Excluir este produto?
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.4 }}>
              Esta ação removerá permanentemente o produto e suas fotos do catálogo da empresa. Deseja continuar?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                style={{
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                }}
              >
                Sim, Excluir Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
