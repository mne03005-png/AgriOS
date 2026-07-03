export const links = {
  platform: 'https://agrios.xyzwtt.com/',
  mobile: 'https://agrios.xyzwtt.com/mobile/',
  demo: 'https://agrios.xyzwtt.com/mobile/'
};

export const navItems = [
  { label: '首页', target: '#home' },
  { label: '产品', target: '#products' },
  { label: '解决方案', target: '#solutions' },
  { label: '核心能力', target: '#capabilities' },
  { label: '应用场景', target: '#scenes' },
  { label: '服务支持', target: '#support' },
  { label: '关于我们', target: '#about' }
];

export const heroMetrics = [
  { label: '土壤湿度', value: '31.2%', hint: '示例遥测' },
  { label: '环境温度', value: '22.5°C', hint: '温室与大田' },
  { label: '设备在线数量', value: '128', hint: '演示数据' },
  { label: '今日灌溉建议', value: '低水量补灌', hint: 'AI 建议' }
];

export const capabilities = [
  { title: '多源设备接入', text: '统一接入传感器、气象站、水泵、阀门、水肥机、无人机与边缘网关。' },
  { title: '实时数据监测', text: '持续观察土壤、气象、设备在线、灌溉状态与异常事件。' },
  { title: '智能农业决策', text: '围绕作物、地块和天气形成灌溉、农事和风险建议。' },
  { title: '安全设备控制', text: '用权限、租户、设备状态、二次确认和审计链路约束每一次执行。' }
];

export const products = [
  ['AgriOS Farm', '农场、地块、作物和农事管理'],
  ['AgriOS IoT', '传感器、气象站、泵阀和设备管理'],
  ['AgriOS Irrigation', '灌溉、轮灌、流量、压力和水肥管理'],
  ['AgriOS AI', '农业建议、预测、异常分析和知识问答'],
  ['AgriOS Edge', '边缘网关、离线缓存和断网续传'],
  ['AgriOS Map', '农场地图、数字孪生和设备空间管理']
].map(([name, text]) => ({ name, text }));

export const regionalSolutions = [
  {
    name: '西北节水农业',
    pain: '水资源紧张、地块分散、轮灌调度复杂。',
    devices: '土壤墒情、流量计、压力表、阀控器、气象站。',
    features: '轮灌计划、灌溉建议、流量压力监测、异常预警。',
    crops: '洋葱、棉花、玉米、枸杞、葡萄。'
  },
  {
    name: '南方果园与设施农业',
    pain: '微气候变化快，病虫害和水肥窗口需要精细管理。',
    devices: '环境传感器、水肥机、滴灌阀、摄像头、边缘网关。',
    features: '环境监测、水肥策略、异常分析、移动巡园。',
    crops: '柑橘、葡萄、草莓、番茄。'
  },
  {
    name: '北方大田与日光温室',
    pain: '季节差异大，农事协同和设施环境管理压力高。',
    devices: '温湿度、光照、土壤温度、泵站、无人机。',
    features: '作物档案、农事记录、温室监测、地图管理。',
    crops: '小麦、玉米、番茄、设施蔬菜。'
  }
];

export const crops = [
  ['洋葱', '围绕墒情、轮灌和病害风险建立节水灌溉闭环。'],
  ['棉花', '关注苗期水分、滴灌压力和大田多地块调度。'],
  ['玉米', '结合天气、土壤水分和生育期形成灌溉建议。'],
  ['小麦', '支持返青、拔节、灌浆等关键阶段的水分管理。'],
  ['水稻', '适配水位监测、排灌记录和田块巡检。'],
  ['葡萄', '面向果园滴灌、水肥协同和微气候异常分析。'],
  ['枸杞', '支持西北特色作物的节水灌溉和长周期档案。'],
  ['柑橘', '关注果园环境、土壤水分和服务团队协作。'],
  ['番茄', '适合设施环境监测、水肥节奏和异常预警。'],
  ['草莓', '支持温室高频环境观察和精细化水肥管理。']
].map(([name, text]) => ({ name, text }));

export const safetySteps = ['用户权限', '租户与农场校验', '设备在线检查', '遥测时效检查', '水位、压力、流量检查', '二次确认', '命令下发', 'ACK 确认', '遥测反馈', '审计记录'];

export const customers = ['家庭农场', '农业合作社', '种植大户', '设施农业园区', '农业服务企业', '设备厂商', '高标准农田项目', '科研示范基地'];

export const demos = [
  { title: '洋葱智慧农场 Demo', text: '从地块档案、墒情监测到灌溉建议，展示一块地的数字化闭环。' },
  { title: '西北节水灌溉方案', text: '围绕滴灌、轮灌、压力流量和用水效率，展示节水农业的运行方式。' },
  { title: '设施农业环境监测方案', text: '面向温室和果园，展示温湿度、光照、设备状态和移动巡检。' }
];
