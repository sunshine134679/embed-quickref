// 编程/嵌入式英语学习词典（移植自 QuickTranslator 半成品）
// 结构：单词 -> { primary, pronunciation:{uk,us}, audio, forms[], usage, senses[{pos,meaning,example,exampleZh}] }
// 词形索引由 useTranslate 构建：输入变形（interrupted）也能命中原型（interrupt）
export default {
  float: {
    primary: 'n. 浮点数；漂浮物  v. 漂浮；使浮动；提出',
    pronunciation: { uk: '/fləʊt/', us: '/floʊt/' },
    audio: 'https://api.dictionaryapi.dev/media/pronunciations/en/float-au.mp3',
    forms: ['float', 'floats', 'floated', 'floating'],
    usage: '在 C/C++ 中，float 是单精度浮点类型；浮点字面量可写成 3.14f。',
    senses: [
      { pos: 'n. 编程', meaning: '浮点数；单精度浮点类型', example: 'float temperature = 36.5f;', exampleZh: '定义一个值为 36.5 的单精度浮点变量。' },
      { pos: 'v.', meaning: '漂浮；使浮动；提出（想法）', example: 'The leaves float on the water.', exampleZh: '树叶漂浮在水面上。' }
    ]
  },
  double: {
    primary: 'n. 双精度浮点数  adj. 双倍的；双重的',
    pronunciation: { uk: '/ˈdʌbəl/', us: '/ˈdʌbəl/' },
    forms: ['double', 'doubles', 'doubled', 'doubling'],
    usage: '在 C/C++ 中，double 通常比 float 精度更高，适合对数值误差更敏感的计算。',
    senses: [
      { pos: 'n. 编程', meaning: '双精度浮点类型', example: 'double voltage = 3.300001;', exampleZh: '使用双精度变量保存电压值。' },
      { pos: 'adj.', meaning: '双倍的；双重的', example: 'Use double precision for the calculation.', exampleZh: '该计算使用双精度。' }
    ]
  },
  int: {
    primary: 'n. 整数；整型',
    pronunciation: { uk: '/ɪnt/', us: '/ɪnt/' },
    forms: ['int', 'ints'],
    usage: 'int 是 C/C++ 最常用的有符号整数类型；具体位宽与平台和编译器有关。',
    senses: [{ pos: 'n. 编程', meaning: '整数；整型', example: 'int count = 0;', exampleZh: '定义并初始化一个整数计数器。' }]
  },
  char: {
    primary: 'n. 字符；字符类型',
    pronunciation: { uk: '/tʃɑː(r)/', us: '/tʃɑːr/' },
    forms: ['char', 'chars'],
    usage: 'char 常用于保存单个字符；char 数组常作为 C 风格字符串的存储空间。',
    senses: [{ pos: 'n. 编程', meaning: '字符；字符类型', example: "char initial = 'A';", exampleZh: '定义一个字符变量并赋值为 A。' }]
  },
  pointer: {
    primary: 'n. 指针；指示器',
    pronunciation: { uk: '/ˈpɔɪntə(r)/', us: '/ˈpɔɪntər/' },
    forms: ['pointer', 'pointers'],
    usage: '指针保存内存地址；使用前必须确认它有效、已初始化且生命周期正确。',
    senses: [{ pos: 'n. 编程', meaning: '指针；内存地址的变量', example: 'int *ptr = &count;', exampleZh: '让指针 ptr 指向变量 count。' }]
  },
  array: {
    primary: 'n. 数组；排列',
    pronunciation: { uk: '/əˈreɪ/', us: '/əˈreɪ/' },
    forms: ['array', 'arrays'],
    usage: '数组连续保存同类型元素；C 语言数组下标从 0 开始，访问时需要防止越界。',
    senses: [{ pos: 'n. 编程', meaning: '数组', example: 'int samples[4] = { 1, 2, 3, 4 };', exampleZh: '定义一个含四个整数的数组。' }]
  },
  string: {
    primary: 'n. 字符串；一串；线',
    pronunciation: { uk: '/strɪŋ/', us: '/strɪŋ/' },
    forms: ['string', 'strings'],
    usage: 'C 字符串以空字符 \\0 结尾；C++ 可使用 std::string 管理文本。',
    senses: [{ pos: 'n. 编程', meaning: '字符串', example: 'const char *name = "Linux";', exampleZh: '定义一个指向字符串常量的指针。' }]
  },
  variable: {
    primary: 'n. 变量；可变因素',
    pronunciation: { uk: '/ˈveəriəbl/', us: '/ˈveriəbl/' },
    forms: ['variable', 'variables'],
    usage: '变量拥有类型、名称、作用域和生命周期；命名应说明它保存的数据含义。',
    senses: [{ pos: 'n. 编程', meaning: '变量', example: 'bool enabled = true;', exampleZh: '定义一个布尔变量，表示是否启用。' }]
  },
  function: {
    primary: 'n. 函数；功能  v. 起作用',
    pronunciation: { uk: '/ˈfʌŋkʃn/', us: '/ˈfʌŋkʃn/' },
    forms: ['function', 'functions', 'functioned', 'functioning'],
    usage: '函数将可复用逻辑封装起来；通过参数接收输入，并可用 return 返回结果。',
    senses: [{ pos: 'n. 编程', meaning: '函数', example: 'int add(int a, int b) { return a + b; }', exampleZh: '定义一个返回两个整数之和的函数。' }]
  },
  parameter: {
    primary: 'n. 参数；形参',
    pronunciation: { uk: '/pəˈræmɪtə(r)/', us: '/pəˈræmɪtər/' },
    forms: ['parameter', 'parameters'],
    usage: 'parameter 指函数定义中的形参；调用函数时传入的实际值称为 argument。',
    senses: [{ pos: 'n. 编程', meaning: '参数；形参', example: 'void delay_ms(int milliseconds);', exampleZh: 'milliseconds 是函数定义中的形参。' }]
  },
  compile: {
    primary: 'v. 编译；汇编；汇总',
    pronunciation: { uk: '/kəmˈpaɪl/', us: '/kəmˈpaɪl/' },
    forms: ['compile', 'compiles', 'compiled', 'compiling'],
    usage: '编译器将源代码转换为目标文件；编译错误通常来自语法、类型或声明问题。',
    senses: [{ pos: 'v. 编程', meaning: '编译', example: 'gcc -Wall main.c -o app', exampleZh: '使用 GCC 编译 main.c 并生成 app。' }]
  },
  debug: {
    primary: 'v. 调试；排错  n. 调试',
    pronunciation: { uk: '/ˌdiːˈbʌɡ/', us: '/ˌdiːˈbʌɡ/' },
    forms: ['debug', 'debugs', 'debugged', 'debugging'],
    usage: '调试应结合日志、断点、调用栈和最小复现；嵌入式环境常使用 GDB/JTAG。',
    senses: [{ pos: 'v. 编程', meaning: '调试；排错', example: 'Use GDB to debug the crash.', exampleZh: '使用 GDB 调试这次崩溃。' }]
  },
  buffer: {
    primary: 'n. 缓冲区；缓冲器',
    pronunciation: { uk: '/ˈbʌfə(r)/', us: '/ˈbʌfər/' },
    forms: ['buffer', 'buffers', 'buffered', 'buffering'],
    usage: '缓冲区用于临时保存数据；必须同时管理长度、边界、所有权与并发访问。',
    senses: [{ pos: 'n. 编程', meaning: '缓冲区', example: 'char buffer[128];', exampleZh: '分配一个可容纳 128 个字符的缓冲区。' }]
  },
  register: {
    primary: 'n. 寄存器；登记  v. 注册；登记',
    pronunciation: { uk: '/ˈredʒɪstə(r)/', us: '/ˈredʒɪstər/' },
    forms: ['register', 'registers', 'registered', 'registering'],
    usage: '硬件寄存器通常通过内存映射 I/O 访问；读写前需理解位定义与时序。',
    senses: [{ pos: 'n. 嵌入式', meaning: '寄存器', example: 'writel(value, base + REG_CTRL);', exampleZh: '向控制寄存器写入 value。' }]
  },
  interrupt: {
    primary: 'n. 中断  v. 中断；打断',
    pronunciation: { uk: '/ˌɪntəˈrʌpt/', us: '/ˌɪntəˈrʌpt/' },
    forms: ['interrupt', 'interrupts', 'interrupted', 'interrupting'],
    usage: '中断服务程序应尽量短小；耗时工作通常延后到下半部、任务或工作队列。',
    senses: [{ pos: 'n. 嵌入式', meaning: '中断', example: 'request_irq(irq, handler, 0, "uart", dev);', exampleZh: '为 UART 设备申请一个中断处理函数。' }]
  },
  thread: {
    primary: 'n. 线程；线',
    pronunciation: { uk: '/θred/', us: '/θred/' },
    forms: ['thread', 'threads', 'threaded', 'threading'],
    usage: '线程共享进程地址空间；共享数据需要用互斥锁、原子操作或其他同步机制保护。',
    senses: [{ pos: 'n. 系统', meaning: '线程', example: 'pthread_create(&tid, NULL, worker, NULL);', exampleZh: '创建一个执行 worker 的 POSIX 线程。' }]
  },
  process: {
    primary: 'n. 进程；过程  v. 处理',
    pronunciation: { uk: '/ˈprəʊses/', us: '/ˈprɑːses/' },
    forms: ['process', 'processes', 'processed', 'processing'],
    usage: '进程拥有独立的虚拟地址空间和资源；fork 可创建子进程，exec 可加载新程序。',
    senses: [{ pos: 'n. 系统', meaning: '进程', example: 'ps -ef | grep app', exampleZh: '查看正在运行的 app 相关进程。' }]
  },
  kernel: {
    primary: 'n. 内核；核心',
    pronunciation: { uk: '/ˈkɜːnl/', us: '/ˈkɜːrnl/' },
    forms: ['kernel', 'kernels'],
    usage: 'Linux 内核负责调度、内存、驱动与系统调用；内核代码不能随意阻塞或访问用户指针。',
    senses: [{ pos: 'n. 系统', meaning: '操作系统内核', example: 'The driver runs in kernel space.', exampleZh: '该驱动运行在内核空间。' }]
  },
  driver: {
    primary: 'n. 驱动程序；驱动器；驱动因素',
    pronunciation: { uk: '/ˈdraɪvə(r)/', us: '/ˈdraɪvər/' },
    forms: ['driver', 'drivers'],
    usage: '设备驱动把内核接口与硬件控制器连接起来，常包括 probe、remove 和电源管理回调。',
    senses: [{ pos: 'n. 嵌入式', meaning: '设备驱动程序', example: 'The driver probes the I2C device.', exampleZh: '驱动程序探测这个 I2C 设备。' }]
  },
  socket: {
    primary: 'n. 套接字；插座',
    pronunciation: { uk: '/ˈsɒkɪt/', us: '/ˈsɑːkɪt/' },
    forms: ['socket', 'sockets'],
    usage: 'socket 是网络通信端点；典型流程为 socket、bind/connect、send/recv、close。',
    senses: [{ pos: 'n. 网络', meaning: '套接字', example: 'int fd = socket(AF_INET, SOCK_STREAM, 0);', exampleZh: '创建一个 IPv4 TCP 套接字。' }]
  }
};
