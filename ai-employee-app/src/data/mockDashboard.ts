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

export interface CoreKpi {
  label: string
  value: string
  unit?: string
  prefix?: string
  suffix?: string
  growth: number // 百分比，正数表示上涨
  growthLabel: string
  color: string
}

export interface TrendPoint {
  label: string
  value: number
}

export interface CategoryShareItem {
  label: string
  value: number
  percent: number
  color: string
}

export interface RegionShareItem {
  label: string
  value: number
}

export interface TopProductItem {
  rank: number
  name: string
  spec: string
  sales: number // 万元
  volume: number
  volumeUnit: string
  growth: number
}

export interface AgentContribution {
  code: string
  name: string
  metrics: { label: string; value: string; growth?: number }[]
}

export interface PlatformDashboard {
  platformId: string
  platformName: string
  kpis: DashboardKpi[]
  coreKpis: CoreKpi[]
  salesTrend: TrendPoint[]
  orderTrend: TrendPoint[]
  categoryShare: CategoryShareItem[]
  regionShare: RegionShareItem[]
  topProducts: TopProductItem[]
  agentContributions: AgentContribution[]
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
  { sku: 'P001', name: '阿莫西林胶囊', spec: '0.25g*24s' },
  { sku: 'P002', name: '布洛芬缓释胶囊', spec: '0.3g*20s' },
  { sku: 'P003', name: '复方甘草片', spec: '100s' },
  { sku: 'P004', name: '维生素C片', spec: '0.1g*100s' },
  { sku: 'P005', name: '头孢克肟颗粒', spec: '50mg*6s' },
  { sku: 'P006', name: '阿司匹林肠溶片', spec: '100mg*30s' },
  { sku: 'P007', name: '感冒灵颗粒', spec: '10g*9s' },
  { sku: 'P008', name: '奥美拉唑肠溶胶囊', spec: '20mg*14s' },
  { sku: 'P009', name: '二甲双胍缓释片', spec: '0.5g*30s' },
  { sku: 'P010', name: '氯雷他定片', spec: '10mg*6s' },
  { sku: 'P011', name: '沙库巴曲缬沙坦钠片', spec: '100mg*14s' },
  { sku: 'P012', name: '氨氯地平片', spec: '5mg*14s' }
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

/** 生成月度标签（最近12个月） */
function genMonthLabels(count = 12): string[] {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const now = new Date()
  const labels: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(months[d.getMonth()])
  }
  return labels
}

/** 生成带趋势的随机序列 */
function genTrendValues(count: number, min: number, max: number, upward = true): number[] {
  const values: number[] = []
  let current = (min + max) / 2
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * (max - min) * 0.15
    const drift = upward ? (max - min) * 0.015 : -(max - min) * 0.005
    current = Math.max(min, Math.min(max, current + drift + noise))
    values.push(Math.round(current))
  }
  return values
}

/** 生成累计增长序列 */
function genCumulativeValues(count: number, min: number, max: number): number[] {
  const values: number[] = []
  let acc = min
  const step = (max - min) / count
  for (let i = 0; i < count; i++) {
    acc += step * (0.8 + Math.random() * 0.4)
    values.push(Math.round(acc))
  }
  return values
}

/** 生成核心指标 */
function genCoreKpis(platformId: string): CoreKpi[] {
  const map: Record<string, CoreKpi[]> = {
    erp: [
      { label: '本月销售额', value: (rand(1200, 2500) / 100).toFixed(1), prefix: '¥', suffix: '万', growth: rand(8, 18), growthLabel: '环比', color: '#3b82f6' },
      { label: '订单总量', value: rand(1200, 2400).toString(), suffix: '单', growth: rand(5, 14), growthLabel: '环比', color: '#10b981' },
      { label: '活跃用户数', value: rand(2800, 4500).toString(), suffix: '人', growth: rand(10, 22), growthLabel: '环比', color: '#8b5cf6' },
      { label: '库存周转天数', value: (rand(180, 320) / 10).toFixed(1), suffix: '天', growth: -rand(5, 15), growthLabel: '环比', color: '#f59e0b' }
    ],
    'b2b-platform': [
      { label: '本月销售额', value: (rand(800, 1600) / 100).toFixed(1), prefix: '¥', suffix: '万', growth: rand(6, 16), growthLabel: '环比', color: '#3b82f6' },
      { label: '订单总量', value: rand(600, 1400).toString(), suffix: '单', growth: rand(4, 12), growthLabel: '环比', color: '#10b981' },
      { label: '活跃用户数', value: rand(800, 1800).toString(), suffix: '人', growth: rand(8, 20), growthLabel: '环比', color: '#8b5cf6' },
      { label: '库存周转天数', value: (rand(200, 360) / 10).toFixed(1), suffix: '天', growth: -rand(3, 10), growthLabel: '环比', color: '#f59e0b' }
    ],
    wms: [
      { label: '本月销售额', value: (rand(500, 1200) / 100).toFixed(1), prefix: '¥', suffix: '万', growth: rand(5, 15), growthLabel: '环比', color: '#3b82f6' },
      { label: '订单总量', value: rand(800, 2000).toString(), suffix: '单', growth: rand(6, 14), growthLabel: '环比', color: '#10b981' },
      { label: '活跃用户数', value: rand(400, 1000).toString(), suffix: '人', growth: rand(7, 18), growthLabel: '环比', color: '#8b5cf6' },
      { label: '库存周转天数', value: (rand(150, 280) / 10).toFixed(1), suffix: '天', growth: -rand(8, 18), growthLabel: '环比', color: '#f59e0b' }
    ],
    bi: [
      { label: '本月销售额', value: (rand(2000, 4000) / 100).toFixed(1), prefix: '¥', suffix: '万', growth: rand(10, 25), growthLabel: '环比', color: '#3b82f6' },
      { label: '订单总量', value: rand(1500, 3000).toString(), suffix: '单', growth: rand(7, 16), growthLabel: '环比', color: '#10b981' },
      { label: '活跃用户数', value: rand(2500, 5000).toString(), suffix: '人', growth: rand(12, 28), growthLabel: '环比', color: '#8b5cf6' },
      { label: '库存周转天数', value: (rand(160, 300) / 10).toFixed(1), suffix: '天', growth: -rand(6, 14), growthLabel: '环比', color: '#f59e0b' }
    ]
  }
  return map[platformId] ?? map['erp']!
}

/** 生成品类销售占比 */
function genCategoryShare(): CategoryShareItem[] {
  const raw = [
    { label: '处方药', color: '#3b82f6' },
    { label: 'OTC', color: '#10b981' },
    { label: '器械', color: '#f59e0b' },
    { label: '保健品', color: '#ef4444' },
    { label: '中药饮片', color: '#8b5cf6' }
  ]
  const values = raw.map(() => rand(50, 400))
  const total = values.reduce((s, v) => s + v, 0)
  return raw.map((item, i) => ({
    ...item,
    value: values[i]!,
    percent: Math.round((values[i]! / total) * 100)
  }))
}

/** 生成区域销售分布 */
function genRegionShare(): RegionShareItem[] {
  const regions = ['华东区', '华南区', '华北区', '西南区', '其他']
  const values = regions.map(() => rand(150, 1000))
  return regions.map((label, i) => ({ label, value: values[i]! }))
}

/** 生成 Top5 热销产品 */
function genTopProducts(): TopProductItem[] {
  const units = ['盒', '瓶', '袋', '支']
  return PRODUCTS.slice(0, 5).map((p, i) => ({
    rank: i + 1,
    name: p.name,
    spec: p.spec,
    sales: rand(80, 450),
    volume: rand(5000, 22000),
    volumeUnit: sample(units),
    growth: rand(-5, 22)
  }))
}

/** 生成智能体贡献看板 */
function genAgentContributions(): AgentContribution[] {
  return [
    {
      code: 'procurement',
      name: '采购兔',
      metrics: [
        { label: '累计节省采购成本', value: `¥${(rand(120, 450) / 10).toFixed(1)}万`, growth: rand(8, 20) },
        { label: '智能比价次数', value: `${rand(1200, 3500)}次` },
        { label: '生成采购订单', value: `${rand(80, 220)}单` }
      ]
    },
    {
      code: 'marketing',
      name: '跟客兔',
      metrics: [
        { label: '转化客户数', value: `${rand(120, 380)}人`, growth: rand(10, 28) },
        { label: '客户跟进次数', value: `${rand(2000, 5000)}次` },
        { label: '新增商机', value: `${rand(60, 180)}个` }
      ]
    },
    {
      code: 'operations',
      name: '运营兔',
      metrics: [
        { label: '生成运营方案', value: `${rand(150, 420)}个`, growth: rand(12, 30) },
        { label: '方案执行中', value: `${rand(30, 90)}个` },
        { label: '已执行完成', value: `${rand(80, 260)}个` }
      ]
    },
    {
      code: 'distribution',
      name: '流向兔',
      metrics: [
        { label: '流向预警次数', value: `${rand(30, 120)}次`, growth: rand(-15, -5) },
        { label: '异常核查数', value: `${rand(20, 80)}条` },
        { label: '正常流向确认', value: `${rand(800, 2200)}条` }
      ]
    },
    {
      code: 'academic',
      name: '学术兔',
      metrics: [
        { label: '学术输出次数', value: `${rand(80, 220)}次`, growth: rand(15, 35) },
        { label: '覆盖客户数', value: `${rand(600, 1800)}人` },
        { label: '客户学习后业绩增长', value: `+${(rand(80, 250) / 10).toFixed(1)}%`, growth: rand(15, 35) }
      ]
    }
  ]
}

/** 单个平台看板 */
export function getPlatformDashboard(platformId: string): PlatformDashboard {
  const stock = genStock()
  const orders = genOrders()
  const shortages = genShortages()
  const flows = genFlows()
  const totalStock = stock.reduce((s, i) => s + i.stock, 0)
  const abnormalFlows = flows.filter((f) => f.abnormal)
  const monthLabels = genMonthLabels()

  switch (platformId) {
    case 'erp':
      return {
        platformId,
        platformName: '企业 ERP 中间库',
        kpis: [
          { icon: Package, label: 'SKU 数', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
          { icon: Boxes, label: '库存总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
          { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
          { icon: Users, label: '合作客户', value: '128', color: 'text-cyan-300' }
        ],
        coreKpis: genCoreKpis(platformId),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 180, 420, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 8000, 22000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        stockBySku: stock,
        orders,
        shortages,
        flows,
        insights: [
          { tag: '预警', warn: true, text: `ERP 数据检测到 ${shortages.length} 个仓库低于安全库存，建议采购兔介入。` },
          ...(abnormalFlows.length > 0
            ? [{ tag: '风险', warn: true, text: `ERP 流向模块发现 ${abnormalFlows.length} 条窜货异常。` }]
            : []),
          { tag: '趋势', text: 'ERP 客户档案 128 家，本周新增 12 家，可交由跟客兔分层跟进。' }
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
        coreKpis: genCoreKpis(platformId),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 120, 320, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 6000, 18000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        orders: genOrders(6),
        insights: [
          { tag: '趋势', text: 'B2B 平台今日订单量较昨日增长 12%，阿莫西林胶囊成热门 SKU。' },
          { tag: '建议', text: '建议运营兔针对高复购客户生成促销方案。' }
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
        coreKpis: genCoreKpis('b2b-platform'),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 60, 200, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 4000, 14000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        orders: genOrders(6).map((o) => ({ ...o, supplier: undefined })),
        insights: [
          { tag: '趋势', text: 'B2C 商城维生素 C 片浏览转化率最高，建议学术兔补充患教内容。' },
          { tag: '建议', text: '晚 20:00-22:00 为下单高峰，可配合运营兔调整推广时段。' }
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
        coreKpis: genCoreKpis(platformId),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 80, 260, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 5000, 16000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
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
        coreKpis: genCoreKpis('wms'),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 40, 180, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 3000, 12000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        flows,
        insights: [
          { tag: '风险', warn: abnormalFlows.length > 0, text: `物流平台识别 ${abnormalFlows.length} 条异常流向，建议流向兔核查。` },
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
        coreKpis: genCoreKpis('b2b-platform'),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 50, 190, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 3500, 13000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        orders: genOrders(5).map((o) => ({ ...o, supplier: undefined })),
        insights: [
          { tag: '趋势', text: '京东店布洛芬缓释胶囊销量领先，天猫店维生素 C 片复购率高。' },
          { tag: '建议', text: '建议跟客兔针对旗舰店会员做分层运营。' }
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
        coreKpis: genCoreKpis('erp'),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 30, 150, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 2500, 10000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        stockBySku: genStock(6),
        insights: [
          { tag: '趋势', text: '门店 POS 显示感冒灵颗粒晚间销量突增，建议关注库存。' },
          { tag: '建议', text: '会员复购率 34%，可交由学术兔推送慢病管理内容。' }
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
        coreKpis: genCoreKpis(platformId),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 220, 520, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 10000, 28000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        insights: [
          { tag: '洞察', text: 'BI 显示本月库存周转天数较上月下降 1.2 天，经营效率提升。' },
          { tag: '风险', warn: true, text: '客户流失率略高于行业均值，建议跟客兔加强挽回策略。' }
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
        coreKpis: genCoreKpis('erp'),
        salesTrend: monthLabels.map((label, i) => ({ label, value: genTrendValues(12, 150, 450, true)[i]! })),
        orderTrend: monthLabels.map((label, i) => ({ label, value: genCumulativeValues(12, 7000, 24000)[i]! })),
        categoryShare: genCategoryShare(),
        regionShare: genRegionShare(),
        topProducts: genTopProducts(),
        agentContributions: genAgentContributions(),
        stockBySku: stock,
        orders,
        shortages,
        flows,
        insights: [
          { tag: '预警', warn: true, text: `SaaS 底座检测到 ${shortages.length} 个仓库低于安全库存，建议采购兔生成补货方案。` },
          ...(abnormalFlows.length > 0
            ? [{ tag: '风险', warn: true, text: `SaaS 底座发现 ${abnormalFlows.length} 条窜货异常流向记录。` }]
            : []),
          { tag: '趋势', text: `合作客户 128 家，覆盖药店 / 诊所 / 商业公司，可交由跟客兔分层跟进。` }
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

  // 总览核心指标：取各平台之和或均值
  const allCore = dashboards.flatMap((d) => d.coreKpis)
  const sumSales = allCore
    .filter((k) => k.label === '本月销售额')
    .reduce((s, k) => s + Number.parseFloat(k.value), 0)
  const sumOrders = allCore
    .filter((k) => k.label === '订单总量')
    .reduce((s, k) => s + Number.parseInt(k.value.replace(/,/g, '')), 0)
  const sumUsers = allCore
    .filter((k) => k.label === '活跃用户数')
    .reduce((s, k) => s + Number.parseInt(k.value.replace(/,/g, '')), 0)
  const avgTurnover = allCore.length
    ? allCore
        .filter((k) => k.label === '库存周转天数')
        .reduce((s, k) => s + Number.parseFloat(k.value), 0) /
      allCore.filter((k) => k.label === '库存周转天数').length
    : 28.6

  return {
    platformId: 'overview',
    platformName: '经营全景',
    kpis: [
      { icon: Package, label: 'SKU 数', value: PRODUCTS.length.toString(), color: 'text-indigo-300' },
      { icon: Boxes, label: '库存总量', value: totalStock.toLocaleString(), color: 'text-emerald-300' },
      { icon: AlertTriangle, label: '缺货预警', value: shortages.length.toString(), color: 'text-rose-300' },
      { icon: Users, label: '合作客户', value: '128', color: 'text-cyan-300' }
    ],
    coreKpis: [
      { label: '本月销售额', value: sumSales.toFixed(1), prefix: '¥', suffix: '万', growth: 12.5, growthLabel: '环比', color: '#3b82f6' },
      { label: '订单总量', value: sumOrders.toLocaleString(), suffix: '单', growth: 8.2, growthLabel: '环比', color: '#10b981' },
      { label: '活跃用户数', value: sumUsers.toLocaleString(), suffix: '人', growth: 15.3, growthLabel: '环比', color: '#8b5cf6' },
      { label: '库存周转天数', value: avgTurnover.toFixed(1), suffix: '天', growth: -2.3, growthLabel: '环比', color: '#f59e0b' }
    ],
    salesTrend: dashboards[0]?.salesTrend ?? [],
    orderTrend: dashboards[0]?.orderTrend ?? [],
    categoryShare: dashboards[0]?.categoryShare ?? genCategoryShare(),
    regionShare: dashboards[0]?.regionShare ?? genRegionShare(),
    topProducts: genTopProducts(),
    agentContributions: genAgentContributions(),
    stockBySku,
    orders: orders.slice(0, 8),
    shortages: shortages.slice(0, 8),
    flows: flows.slice(0, 8),
    insights: [
      { tag: '预警', warn: true, text: `全平台共有 ${shortages.length} 个仓库低于安全库存，建议采购兔生成补货方案。` },
      ...(abnormalFlows.length > 0
        ? [{ tag: '风险', warn: true, text: `全平台检测到 ${abnormalFlows.length} 条窜货异常流向记录，建议流向兔核查渠道。` }]
        : []),
      { tag: '趋势', text: `当前已接入 ${platformIds.length} 个数据底座，经营全景实时聚合中。` }
    ]
  }
}

export { productName }
