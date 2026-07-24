// 医药 SaaS 数据底座（mock）
// 严格对齐 YesGo 文档所述的底层多租户医药 SaaS 数据模型：
// 商品 / 库存 / 订单 / 流向 / 客户
// 当前为前端 mock，预留「接入真实 SaaS」接缝 —— 后续把 readXxx 换成对 SaaS API 的调用即可。

export interface Product {
  sku: string
  name: string
  spec: string
  manufacturer: string
  category: string
}

export interface Inventory {
  sku: string
  warehouse: string
  stock: number
  safetyStock: number
  unit: string
}

export interface Order {
  id: string
  sku: string
  qty: number
  supplier: string
  status: 'draft' | 'submitted' | 'done'
  createdAt: string
}

export interface FlowRecord {
  id: string
  sku: string
  fromRegion: string
  toRegion: string
  qty: number
  abnormal: boolean // 是否窜货异常
}

export interface Customer {
  id: string
  name: string
  type: '药店' | '诊所' | '商业公司'
  region: string
  ownerAgent: 'crm' | 'ops'
}

const PRODUCTS: Product[] = [
  { sku: 'P001', name: '阿莫西林胶囊', spec: '0.25g*24粒', manufacturer: '联邦制药', category: '抗生素' },
  { sku: 'P002', name: '布洛芬缓释胶囊', spec: '0.3g*20粒', manufacturer: '中美天津史克', category: '解热镇痛' },
  { sku: 'P003', name: '复方甘草片', spec: '100片', manufacturer: '太极集团', category: '止咳化痰' },
  { sku: 'P004', name: '维生素C片', spec: '100mg*100片', manufacturer: '东北制药', category: '维生素' },
  { sku: 'P005', name: '头孢克肟颗粒', spec: '50mg*6袋', manufacturer: '白云山', category: '抗生素' },
  { sku: 'P006', name: '阿司匹林肠溶片', spec: '100mg*30片', manufacturer: '拜耳医药', category: '心脑血管' },
  { sku: 'P007', name: '感冒灵颗粒', spec: '10g*9袋', manufacturer: '华润三九', category: '感冒用药' },
  { sku: 'P008', name: '奥美拉唑肠溶胶囊', spec: '20mg*14粒', manufacturer: '阿斯利康', category: '消化系统' },
  { sku: 'P009', name: '二甲双胍缓释片', spec: '0.5g*30片', manufacturer: '中美华东', category: '降糖药' },
  { sku: 'P010', name: '氯雷他定片', spec: '10mg*6片', manufacturer: '先声药业', category: '抗过敏' },
  { sku: 'P011', name: '蒲地蓝消炎口服液', spec: '10ml*10支', manufacturer: '济川药业', category: '清热解毒' },
  { sku: 'P012', name: '复方丹参滴丸', spec: '27mg*180粒', manufacturer: '天士力', category: '心脑血管' },
  { sku: 'P013', name: '蒙脱石散', spec: '3g*10袋', manufacturer: '博福-益普生', category: '止泻药' },
  { sku: 'P014', name: '布洛芬混悬液', spec: '100ml', manufacturer: '强生制药', category: '儿童用药' },
  { sku: 'P015', name: '硝苯地平控释片', spec: '30mg*7片', manufacturer: '拜耳医药', category: '降压药' }
]

const INVENTORY: Inventory[] = [
  { sku: 'P001', warehouse: '中心仓', stock: 1200, safetyStock: 800, unit: '盒' },
  { sku: 'P001', warehouse: '华东仓', stock: 320, safetyStock: 600, unit: '盒' }, // 低于安全库存
  { sku: 'P001', warehouse: '华南仓', stock: 540, safetyStock: 600, unit: '盒' }, // 低于安全库存
  { sku: 'P002', warehouse: '中心仓', stock: 2600, safetyStock: 1000, unit: '盒' },
  { sku: 'P002', warehouse: '华东仓', stock: 900, safetyStock: 800, unit: '盒' },
  { sku: 'P002', warehouse: '华北仓', stock: 760, safetyStock: 700, unit: '盒' },
  { sku: 'P003', warehouse: '中心仓', stock: 150, safetyStock: 400, unit: '瓶' }, // 低于安全库存
  { sku: 'P003', warehouse: '西南仓', stock: 60, safetyStock: 300, unit: '瓶' }, // 低于安全库存
  { sku: 'P003', warehouse: '华中仓', stock: 380, safetyStock: 300, unit: '瓶' },
  { sku: 'P004', warehouse: '中心仓', stock: 5000, safetyStock: 2000, unit: '瓶' },
  { sku: 'P004', warehouse: '华南仓', stock: 2100, safetyStock: 1800, unit: '瓶' },
  { sku: 'P005', warehouse: '华东仓', stock: 480, safetyStock: 500, unit: '袋' }, // 低于安全库存
  { sku: 'P005', warehouse: '华南仓', stock: 700, safetyStock: 500, unit: '袋' },
  { sku: 'P005', warehouse: '华中仓', stock: 620, safetyStock: 600, unit: '袋' },
  { sku: 'P006', warehouse: '中心仓', stock: 980, safetyStock: 600, unit: '盒' },
  { sku: 'P006', warehouse: '华北仓', stock: 410, safetyStock: 500, unit: '盒' }, // 低于安全库存
  { sku: 'P007', warehouse: '中心仓', stock: 1500, safetyStock: 800, unit: '盒' },
  { sku: 'P007', warehouse: '华东仓', stock: 720, safetyStock: 700, unit: '盒' },
  { sku: 'P007', warehouse: '华南仓', stock: 540, safetyStock: 600, unit: '盒' }, // 低于安全库存
  { sku: 'P008', warehouse: '中心仓', stock: 640, safetyStock: 500, unit: '盒' },
  { sku: 'P008', warehouse: '华中仓', stock: 360, safetyStock: 400, unit: '盒' }, // 低于安全库存
  { sku: 'P009', warehouse: '中心仓', stock: 850, safetyStock: 500, unit: '盒' },
  { sku: 'P009', warehouse: '西南仓', stock: 290, safetyStock: 400, unit: '盒' }, // 低于安全库存
  { sku: 'P009', warehouse: '华北仓', stock: 520, safetyStock: 500, unit: '盒' },
  { sku: 'P010', warehouse: '中心仓', stock: 1100, safetyStock: 600, unit: '盒' },
  { sku: 'P010', warehouse: '华东仓', stock: 430, safetyStock: 500, unit: '盒' }, // 低于安全库存
  { sku: 'P010', warehouse: '华南仓', stock: 560, safetyStock: 500, unit: '盒' },
  { sku: 'P011', warehouse: '中心仓', stock: 920, safetyStock: 600, unit: '盒' },
  { sku: 'P011', warehouse: '华中仓', stock: 300, safetyStock: 400, unit: '盒' }, // 低于安全库存
  { sku: 'P012', warehouse: '中心仓', stock: 1300, safetyStock: 700, unit: '盒' },
  { sku: 'P012', warehouse: '华北仓', stock: 410, safetyStock: 500, unit: '盒' }, // 低于安全库存
  { sku: 'P012', warehouse: '西南仓', stock: 350, safetyStock: 400, unit: '盒' }, // 低于安全库存
  { sku: 'P013', warehouse: '中心仓', stock: 760, safetyStock: 500, unit: '盒' },
  { sku: 'P013', warehouse: '华东仓', stock: 480, safetyStock: 500, unit: '盒' }, // 低于安全库存
  { sku: 'P014', warehouse: '中心仓', stock: 640, safetyStock: 400, unit: '瓶' },
  { sku: 'P014', warehouse: '华南仓', stock: 280, safetyStock: 350, unit: '瓶' }, // 低于安全库存
  { sku: 'P015', warehouse: '中心仓', stock: 880, safetyStock: 500, unit: '盒' },
  { sku: 'P015', warehouse: '华中仓', stock: 340, safetyStock: 400, unit: '盒' }, // 低于安全库存
  { sku: 'P015', warehouse: '华北仓', stock: 470, safetyStock: 500, unit: '盒' }
]

// 供应商主数据（含到各仓的到货时效与报价系数，用于生成三套方案）
export interface Supplier {
  name: string
  leadTimeDays: number
  priceFactor: number // 1.0 = 基准价
}

const SUPPLIERS: Supplier[] = [
  { name: '国药控股（华东）', leadTimeDays: 1, priceFactor: 1.08 },
  { name: '九州通医药（华中）', leadTimeDays: 2, priceFactor: 1.0 },
  { name: '华润医药（华南）', leadTimeDays: 3, priceFactor: 0.94 },
  { name: '英特集团（华东）', leadTimeDays: 2, priceFactor: 1.03 },
  { name: '本地商业公司（就近）', leadTimeDays: 1, priceFactor: 1.12 }
]

// 历史采购订单（演示用，含运行时 submitOrder 新增的订单）
const ORDERS: Order[] = [
  { id: 'PO240701', sku: 'P007', qty: 500, supplier: '九州通医药（华中）', status: 'done', createdAt: '2026-07-01' },
  { id: 'PO240705', sku: 'P001', qty: 800, supplier: '国药控股（华东）', status: 'done', createdAt: '2026-07-05' },
  { id: 'PO240710', sku: 'P004', qty: 1200, supplier: '华润医药（华南）', status: 'done', createdAt: '2026-07-10' },
  { id: 'PO240715', sku: 'P002', qty: 600, supplier: '英特集团（华东）', status: 'submitted', createdAt: '2026-07-15' },
  { id: 'PO240718', sku: 'P012', qty: 400, supplier: '九州通医药（华中）', status: 'submitted', createdAt: '2026-07-18' },
  { id: 'PO240620', sku: 'P006', qty: 300, supplier: '国药控股（华东）', status: 'done', createdAt: '2026-06-20' },
  { id: 'PO240628', sku: 'P009', qty: 350, supplier: '华润医药（华南）', status: 'done', createdAt: '2026-06-28' },
  { id: 'PO240702', sku: 'P010', qty: 450, supplier: '英特集团（华东）', status: 'done', createdAt: '2026-07-02' },
  { id: 'PO240711', sku: 'P013', qty: 280, supplier: '九州通医药（华中）', status: 'draft', createdAt: '2026-07-11' },
  { id: 'PO240630', sku: 'P008', qty: 320, supplier: '国药控股（华东）', status: 'done', createdAt: '2026-06-30' },
  { id: 'PO240709', sku: 'P014', qty: 260, supplier: '华润医药（华南）', status: 'done', createdAt: '2026-07-09' },
  { id: 'PO240716', sku: 'P015', qty: 300, supplier: '九州通医药（华中）', status: 'submitted', createdAt: '2026-07-16' }
]
const FLOWS: FlowRecord[] = [
  { id: 'F001', sku: 'P002', fromRegion: '华东', toRegion: '华南', qty: 300, abnormal: false },
  { id: 'F002', sku: 'P001', fromRegion: '华南', toRegion: '华北', qty: 500, abnormal: true }, // 窜货异常
  { id: 'F003', sku: 'P007', fromRegion: '华中', toRegion: '西南', qty: 220, abnormal: false },
  { id: 'F004', sku: 'P012', fromRegion: '华北', toRegion: '华南', qty: 180, abnormal: false },
  { id: 'F005', sku: 'P004', fromRegion: '华南', toRegion: '华东', qty: 640, abnormal: true }, // 窜货异常
  { id: 'F006', sku: 'P009', fromRegion: '西南', toRegion: '华北', qty: 150, abnormal: false },
  { id: 'F007', sku: 'P006', fromRegion: '华东', toRegion: '西北', qty: 90, abnormal: true }, // 窜货异常
  { id: 'F008', sku: 'P010', fromRegion: '华中', toRegion: '华南', qty: 260, abnormal: false }
]
const CUSTOMERS: Customer[] = [
  { id: 'C001', name: '康健大药房（旗舰店）', type: '药店', region: '上海', ownerAgent: 'crm' },
  { id: 'C002', name: '仁和诊所', type: '诊所', region: '杭州', ownerAgent: 'crm' },
  { id: 'C003', name: '民生大药房连锁', type: '药店', region: '广州', ownerAgent: 'crm' },
  { id: 'C004', name: '老百姓大药房', type: '药店', region: '长沙', ownerAgent: 'crm' },
  { id: 'C005', name: '同仁堂药店', type: '药店', region: '北京', ownerAgent: 'crm' },
  { id: 'C006', name: '益丰大药房', type: '药店', region: '武汉', ownerAgent: 'crm' },
  { id: 'C007', name: '美年健康诊所', type: '诊所', region: '南京', ownerAgent: 'crm' },
  { id: 'C008', name: '康宁诊所', type: '诊所', region: '成都', ownerAgent: 'crm' },
  { id: 'C009', name: '九州通商业公司', type: '商业公司', region: '武汉', ownerAgent: 'ops' },
  { id: 'C010', name: '国药控股（华东）', type: '商业公司', region: '上海', ownerAgent: 'ops' },
  { id: 'C011', name: '大参林连锁', type: '药店', region: '深圳', ownerAgent: 'crm' },
  { id: 'C012', name: '漱玉平民大药房', type: '药店', region: '济南', ownerAgent: 'crm' }
]

// —— 数据读取接口（预留接入真实 SaaS 的接缝）——
// TODO: 接入真实 SaaS —— 以下函数替换为对多租户医药 SaaS OpenAPI / 数据中台的调用

export function getProducts(): Product[] {
  return PRODUCTS
}

export function findProduct(keyword: string): Product | undefined {
  const k = keyword.trim()
  if (!k) return undefined
  return PRODUCTS.find(
    (p) => p.name.includes(k) || p.sku.toLowerCase() === k.toLowerCase() || p.manufacturer.includes(k)
  )
}

export function getInventory(sku: string): Inventory[] {
  return INVENTORY.filter((i) => i.sku === sku)
}

/** 全量库存 */
export function getAllInventory(): Inventory[] {
  return INVENTORY
}

/** 低于安全库存的仓库 → 需补货清单 */
export function getShortages(sku: string): Inventory[] {
  return INVENTORY.filter((i) => i.sku === sku && i.stock < i.safetyStock)
}

/** 全量缺货预警（所有低于安全库存的仓） */
export function getAllShortages(): (Inventory & { productName: string })[] {
  return INVENTORY.filter((i) => i.stock < i.safetyStock).map((i) => ({
    ...i,
    productName: PRODUCTS.find((p) => p.sku === i.sku)?.name ?? i.sku
  }))
}

/** 全部订单（含运行时新增的采购单） */
export function getOrders(): Order[] {
  return ORDERS
}

export function productName(sku: string): string {
  return PRODUCTS.find((p) => p.sku === sku)?.name ?? sku
}

export function getSuppliers(): Supplier[] {
  return SUPPLIERS
}

export function getFlows(): FlowRecord[] {
  return FLOWS
}

export function getCustomers(): Customer[] {
  return CUSTOMERS
}

/** 下单（回写 SaaS）——当前写入内存 mock，预留真实订单接口 */
export function submitOrder(sku: string, qty: number, supplier: string): Order {
  const order: Order = {
    id: `PO${Date.now().toString().slice(-6)}`,
    sku,
    qty,
    supplier,
    status: 'submitted',
    createdAt: new Date().toISOString()
  }
  ORDERS.push(order)
  return order
}
