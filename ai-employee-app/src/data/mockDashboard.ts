import {
  Package,
  Boxes,
  AlertTriangle,
  Users,
  ShoppingCart,
  MapPin,
  CreditCard,
  Truck,
  BarChart3,
  type LucideIcon
} from 'lucide-react'

export interface DashboardKpi {
  icon: LucideIcon
  label: string
  value: string
  color: string
}

export interface StockItem {
  name: string
  stock: number
}

export interface OrderItem {
  id: string
  sku: string
  productName: string
  qty: number
  supplier?: string
  status: 'done' | 'submitted' | 'draft'
}

export interface ShortageItem {
  sku: string
  productName: string
  warehouse: string
  stock: number
  safetyStock: number
  unit: string
}

export interface FlowItem {
  id: string
  sku: string
  productName: string
  fromRegion: string
  toRegion: string
  qty: number
  abnormal: boolean
}

export interface InsightItem {
  tag: string
  warn?: boolean
  text: string
}

export interface PlatformDashboard {
  platformId: string
  platformName: string
  kpis: DashboardKpi[]
  stockBySku?: StockItem[]
  orders?: OrderItem[]
  shortages?: ShortageItem[]
  flows?: FlowItem[]
  insights: InsightItem[]
}

const orderStatus = {
  done: { label: '已完成', color: 'text-emerald-300' },
  submitted: { label: '执行中', color: 'text-amber-300' },
  draft: { label: '草稿', color: 'text-text-muted' }
} as const

export { orderStatus }

const PRODUCTS = [
  { sku: 'P001', name: '阿莫西林胶囊' },
  { sku: 'P002', name: '布洛芬缓释胶囊' },
  { sku: 'P003', name: '复方甘草片' },
  { sku: 'P004', name: '维生素C片' },
  { sku: 'P005', name: '头孢克肟颗粒' },
  { sku: 'P006', name: '阿司匹林肠溶片' },
  { sku: 'P007', name: '感冒灵颗粒' },
  { sku: 'P008', name: '奥美拉唑肠溶胶囊' },
  { sku: 'P009', name: '二甲双胍缓释片' },
  { sku: 'P010', name: '氯雷他定片' }
]

const WAREHOUSES = ['华东仓', '华南仓', '华北仓', '西南仓']

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sample<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function productName(sku: string) {
  return PRODUCTS.find((p) => p.sku === sku)?.name ?? sku
}

/** 生成商品库存分布 */
function genStock(count = 8): StockItem[] {
  return PRODUCTS.slice(0, count).map((p) => ({ name: p.name, stock: rand(500, 8000) }))
}

/** 生成订单 */
function genOrders(count = 5): OrderItem[] {
  const suppliers = ['九州通医药', '国药控股', '华润医药', '上药控股', '复星医药']
  return Array.from({ length: count }, () => {
    const p = sample(PRODUCTS)
    return {
      id: `ORD-${String(rand(1000, 9999))}`,
      sku: p.sku,
      productName: p.name,
      qty: rand(100, 2000),
      supplier: sample(suppliers),
      status: sample(['done', 'submitted', 'done', 'submitted', 'draft']) as OrderItem['status']
    }
  })
}

/** 生成缺货预警 */
function genShortages(count = 4): ShortageItem[] {
  return Array.from({ length: count }, () => {
    const p = sample(PRODUCTS)
    const safety = rand(800, 2000)
    const stock = rand(100, safety - 100)
    return {
      sku: p.sku,
      productName: p.name,
      warehouse: sample(WAREHOUSES),
      stock,
      safetyStock: safety,
      unit: '盒'
    }
  })
}

/** 生成流向 */
function genFlows(count = 6): FlowItem[] {
  const regions = ['上海', '浙江', '江苏', '安徽', '山东', '河南', '湖北', '广东']
  return Array.from({ length: count }, () => {
    const p = sample(PRODUCTS)
    const from = sample(regions)
    let to = sample(regions)
    while (to === from) to = sample(regions)
    const abnormal = Math.random() > 0.75
    return {
      id: `F-${String(rand(1000, 9999))}`,
      sku: p.sku,
      productName: p.name,
      fromRegion: from,
      toRegion: to,
      qty: rand(50, 500),
      abnormal
    }
  })
}

/** 单个平台看板 */
export function getPlatformDashboard(platformId: string): PlatformDashboard {
  const stock = genStock()
  const orders = genOrders()
  const shortages = genShortages()
  const flows = genFlows()
  const totalStock = stock.reduce((s, i) => s + i.stock, 0)
  const abnormalFlows = flows.filter((f) => f.abnormal)

  switch (platformId) {
    case 'erp':
      return {
        platformId,
        platformName: '企业 ERP',
        kpis: [
          { icon: Package, label: 'SKU 数', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
          { icon: Boxes, label: '库存总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
          { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
          { icon: Users, label: '合作客户', value: '128', color: 'text-cyan-300' }
        ],
        stockBySku: stock,
        orders,
        shortages,
        flows,
        insights: [
          { tag: '预警', warn: true, text: `ERP 数据检测到 ${shortages.length} 个仓库低于安全库存，建议采购智能体介入。` },
          ...(abnormalFlows.length > 0
            ? [{ tag: '风险', warn: true, text: `ERP 流向模块发现 ${abnormalFlows.length} 条窜货异常。` }]
            : []),
          { tag: '趋势', text: 'ERP 客户档案 128 家，本周新增 12 家，可交由跟客智能体分层跟进。' }
        ]
      }

    case 'b2b-platform':
      return {
        platformId,
        platformName: 'B2B 电商平台',
        kpis: [
          { icon: ShoppingCart, label: '今日订单', value: rand(80, 250).toString(), color: 'text-indigo-300' },
          { icon: Boxes, label: '成交件数', value: rand(5000, 15000).toLocaleString(), color: 'text-emerald-300' },
          { icon: Users, label: '采购客户', value: rand(40, 90).toString(), color: 'text-cyan-300' },
          { icon: BarChart3, label: '成交额', value: `¥${rand(80, 250)}万`, color: 'text-amber-300' }
        ],
        orders: genOrders(6),
        insights: [
          { tag: '趋势', text: 'B2B 平台今日订单量较昨日增长 12%，阿莫西林胶囊成热门 SKU。' },
          { tag: '建议', text: '建议运营智能体针对高复购客户生成促销方案。' }
        ]
      }

    case 'b2c-store':
      return {
        platformId,
        platformName: 'B2C 零售商城',
        kpis: [
          { icon: ShoppingCart, label: '今日订单', value: rand(300, 800).toString(), color: 'text-indigo-300' },
          { icon: Users, label: '访客数', value: rand(5000, 12000).toLocaleString(), color: 'text-cyan-300' },
          { icon: Boxes, label: '成交件数', value: rand(800, 2200).toString(), color: 'text-emerald-300' },
          { icon: CreditCard, label: '客单价', value: `¥${rand(120, 260)}`, color: 'text-amber-300' }
        ],
        orders: genOrders(6).map((o) => ({ ...o, supplier: undefined })),
        insights: [
          { tag: '趋势', text: 'B2C 商城维生素 C 片浏览转化率最高，建议学术智能体补充患教内容。' },
          { tag: '建议', text: '晚 20:00-22:00 为下单高峰，可配合运营智能体调整推广时段。' }
        ]
      }

    case 'wms':
      return {
        platformId,
        platformName: '第三方仓储 WMS',
        kpis: [
          { icon: Boxes, label: '在库总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
          { icon: Package, label: '覆盖 SKU', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
          { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
          { icon: Truck, label: '今日出库', value: rand(1200, 3500).toLocaleString(), color: 'text-cyan-300' }
        ],
        stockBySku: stock,
        shortages,
        insights: [
          { tag: '预警', warn: true, text: `WMS 显示 ${shortages.length} 个 SKU 低于安全库存，需尽快补货。` },
          { tag: '趋势', text: '华东仓出库量占比 45%，库存周转最快。' }
        ]
      }

    case 'logistics':
      return {
        platformId,
        platformName: '物流追踪平台',
        kpis: [
          { icon: Truck, label: '在途订单', value: rand(200, 600).toString(), color: 'text-indigo-300' },
          { icon: MapPin, label: '今日签收', value: rand(800, 1800).toString(), color: 'text-emerald-300' },
          { icon: AlertTriangle, label: '异常件', value: rand(3, 15).toString(), color: 'text-rose-300' },
          { icon: BarChart3, label: '准时率', value: `${rand(92, 99)}%`, color: 'text-cyan-300' }
        ],
        flows,
        insights: [
          { tag: '风险', warn: abnormalFlows.length > 0, text: `物流平台识别 ${abnormalFlows.length} 条异常流向，建议流向智能体核查。` },
          { tag: '趋势', text: '近 7 天物流准时率 96.5%，华东区域表现最优。' }
        ]
      }

    case 'tmall-jd':
      return {
        platformId,
        platformName: '天猫 / 京东旗舰店',
        kpis: [
          { icon: ShoppingCart, label: '今日订单', value: rand(500, 1200).toString(), color: 'text-indigo-300' },
          { icon: Boxes, label: '成交件数', value: rand(1500, 4000).toString(), color: 'text-emerald-300' },
          { icon: Users, label: '新增粉丝', value: rand(100, 350).toString(), color: 'text-cyan-300' },
          { icon: CreditCard, label: '成交额', value: `¥${rand(30, 90)}万`, color: 'text-amber-300' }
        ],
        orders: genOrders(5).map((o) => ({ ...o, supplier: undefined })),
        insights: [
          { tag: '趋势', text: '京东店布洛芬缓释胶囊销量领先，天猫店维生素 C 片复购率高。' },
          { tag: '建议', text: '建议跟客智能体针对旗舰店会员做分层运营。' }
        ]
      }

    case 'pos':
      return {
        platformId,
        platformName: '门店 POS 系统',
        kpis: [
          { icon: CreditCard, label: '今日销售', value: `¥${rand(15, 45)}万`, color: 'text-indigo-300' },
          { icon: ShoppingCart, label: '交易笔数', value: rand(1200, 3000).toString(), color: 'text-emerald-300' },
          { icon: Boxes, label: '动销 SKU', value: rand(80, 150).toString(), color: 'text-cyan-300' },
          { icon: Users, label: '会员数', value: rand(3000, 8000).toLocaleString(), color: 'text-amber-300' }
        ],
        stockBySku: genStock(6),
        insights: [
          { tag: '趋势', text: '门店 POS 显示感冒灵颗粒晚间销量突增，建议关注库存。' },
          { tag: '建议', text: '会员复购率 34%，可交由学术智能体推送慢病管理内容。' }
        ]
      }

    case 'bi':
      return {
        platformId,
        platformName: '企业经营 BI',
        kpis: [
          { icon: BarChart3, label: '月度营收', value: `¥${rand(800, 1500)}万`, color: 'text-indigo-300' },
          { icon: Boxes, label: '库存周转', value: `${rand(8, 20)}天`, color: 'text-emerald-300' },
          { icon: CreditCard, label: '毛利率', value: `${rand(18, 32)}%`, color: 'text-cyan-300' },
          { icon: Users, label: '客户流失', value: `${rand(2, 8)}%`, color: 'text-rose-300' }
        ],
        insights: [
          { tag: '洞察', text: 'BI 显示本月库存周转天数较上月下降 1.2 天，经营效率提升。' },
          { tag: '风险', warn: true, text: '客户流失率略高于行业均值，建议跟客智能体加强挽回策略。' }
        ]
      }

    case 'saas-base':
    default:
      return {
        platformId,
        platformName: '医药 SaaS 底座',
        kpis: [
          { icon: Package, label: 'SKU 数', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
          { icon: Boxes, label: '库存总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
          { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
          { icon: Users, label: '合作客户', value: '128', color: 'text-cyan-300' }
        ],
        stockBySku: stock,
        orders,
        shortages,
        flows,
        insights: [
          { tag: '预警', warn: true, text: `SaaS 底座检测到 ${shortages.length} 个仓库低于安全库存，建议采购智能体生成补货方案。` },
          ...(abnormalFlows.length > 0
            ? [{ tag: '风险', warn: true, text: `SaaS 底座发现 ${abnormalFlows.length} 条窜货异常流向记录。` }]
            : []),
          { tag: '趋势', text: '合作客户 128 家，覆盖药店 / 诊所 / 商业公司，可交由跟客智能体分层跟进。' }
        ]
      }
  }
}

/** 总览看板：聚合所有已启用平台的关键指标 */
export function getOverviewDashboard(platformIds: string[]): PlatformDashboard {
  const dashboards = platformIds.map(getPlatformDashboard)

  // 聚合库存（去重按 SKU 求和）
  const stockMap = new Map<string, number>()
  dashboards.forEach((d) => {
    d.stockBySku?.forEach((s) => {
      stockMap.set(s.name, (stockMap.get(s.name) ?? 0) + s.stock)
    })
  })
  const stockBySku = Array.from(stockMap.entries())
    .map(([name, stock]) => ({ name, stock }))
    .sort((a, b) => b.stock - a.stock)

  // 聚合订单
  const orders = dashboards.flatMap((d) => d.orders ?? [])

  // 聚合缺货
  const shortages = dashboards.flatMap((d) => d.shortages ?? [])

  // 聚合流向异常
  const flows = dashboards.flatMap((d) => d.flows ?? [])
  const abnormalFlows = flows.filter((f) => f.abnormal)

  const totalStock = stockBySku.reduce((s, i) => s + i.stock, 0)

  return {
    platformId: 'overview',
    platformName: '经营全景',
    kpis: [
      { icon: Package, label: 'SKU 数', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
      { icon: Boxes, label: '库存总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
      { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
      { icon: Users, label: '合作客户', value: '128', color: 'text-cyan-300' }
    ],
    stockBySku,
    orders: orders.slice(0, 8),
    shortages: shortages.slice(0, 8),
    flows: flows.slice(0, 8),
    insights: [
      { tag: '预警', warn: true, text: `全平台共有 ${shortages.length} 个仓库低于安全库存，建议采购智能体生成补货方案。` },
      ...(abnormalFlows.length > 0
        ? [{ tag: '风险', warn: true, text: `全平台检测到 ${abnormalFlows.length} 条窜货异常流向记录，建议流向智能体核查渠道。` }]
        : []),
      { tag: '趋势', text: `当前已接入 ${platformIds.length} 个数据底座，经营全景实时聚合中。` }
    ]
  }
}

export { productName }
