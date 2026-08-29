// 编程/嵌入式英语学习词典（移植自 QuickTranslator 半成品）
// 结构：单词 -> { primary, pronunciation:{uk,us}, forms[], usage, senses[{pos,meaning,example,exampleZh}] }
// 词形索引由 useTranslate 构建：输入变形（interrupted）也能命中原型（interrupt）
export default {
  float: {
    primary: 'n. 浮点数；漂浮物  v. 漂浮；使浮动；提出',
    pronunciation: { uk: '/fləʊt/', us: '/floʊt/' },
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
  },
  // ---------- 2026-08-15 扩充：编程与开发高频词 ----------
  integer: {
    primary: 'n. 整数；整型',
    pronunciation: { uk: '/ˈɪntɪdʒə(r)/', us: '/ˈɪntɪdʒər/' },
    forms: ['integer', 'integers'],
    usage: 'integer 与 int 同义；在强调数学含义或位宽时更常用，如 integer overflow（整数溢出）。',
    senses: [{ pos: 'n. 编程', meaning: '整数', example: 'The counter must be a non-negative integer.', exampleZh: '计数器必须是非负整数。' }]
  },
  boolean: {
    primary: 'n. 布尔值  adj. 布尔类型的',
    pronunciation: { uk: '/ˈbuːliən/', us: '/ˈbuːliən/' },
    forms: ['boolean', 'booleans'],
    usage: '布尔值只有 true/false 两个取值；C 语言用 stdbool.h 引入 bool 类型。',
    senses: [{ pos: 'n. 编程', meaning: '布尔值；逻辑值', example: 'bool ready = (status == OK);', exampleZh: '用一个布尔值记录状态是否为 OK。' }]
  },
  unsigned: {
    primary: 'adj. 无符号的  n. 无符号数',
    pronunciation: { uk: '/ʌnˈsaɪnd/', us: '/ʌnˈsaɪnd/' },
    forms: ['unsigned'],
    usage: '无符号类型只能表示非负值；做减法或比较时小心下溢导致的回绕。',
    senses: [{ pos: 'adj. 编程', meaning: '无符号的', example: 'unsigned int length = 0;', exampleZh: '定义一个无符号整型变量。' }]
  },
  signed: {
    primary: 'adj. 有符号的',
    pronunciation: { uk: '/saɪnd/', us: '/saɪnd/' },
    forms: ['signed'],
    usage: '有符号类型可表示正负值；默认的 int 一般是有符号的。',
    senses: [{ pos: 'adj. 编程', meaning: '有符号的', example: 'A signed char can hold -128..127.', exampleZh: '有符号 char 可表示 -128 到 127。' }]
  },
  byte: {
    primary: 'n. 字节',
    pronunciation: { uk: '/baɪt/', us: '/baɪt/' },
    forms: ['byte', 'bytes'],
    usage: 'byte 是最小的可寻址单位，通常为 8 位；注意与 bit（位）区分。',
    senses: [{ pos: 'n. 编程', meaning: '字节', example: 'The file is 4096 bytes long.', exampleZh: '该文件长度为 4096 字节。' }]
  },
  bit: {
    primary: 'n. 位；比特；一点儿',
    pronunciation: { uk: '/bɪt/', us: '/bɪt/' },
    forms: ['bit', 'bits'],
    usage: 'bit 是二进制的一位；用位运算（& | ^ ~ << >>）可高效地设置和读取寄存器位。',
    senses: [{ pos: 'n. 编程', meaning: '二进制位', example: 'Set bit 3 of the control register.', exampleZh: '置位控制寄存器的第 3 位。' }]
  },
  struct: {
    primary: 'n. 结构体',
    pronunciation: { uk: '/strʌkt/', us: '/strʌkt/' },
    forms: ['struct', 'structs'],
    usage: 'struct 把相关字段组合成一个复合类型；C 语言中 struct 类型常配合 typedef 使用。',
    senses: [{ pos: 'n. 编程', meaning: '结构体', example: 'struct point { int x; int y; };', exampleZh: '定义一个包含 x、y 坐标的结构体。' }]
  },
  union: {
    primary: 'n. 联合体；联盟；工会',
    pronunciation: { uk: '/ˈjuːniən/', us: '/ˈjuːnjən/' },
    forms: ['union', 'unions'],
    usage: 'union 的所有成员共享同一块内存，常用于解析协议字节流或做类型转换。',
    senses: [{ pos: 'n. 编程', meaning: '联合体', example: 'union u { int i; float f; };', exampleZh: '让同一个内存位置可被当作整数或浮点访问。' }]
  },
  enum: {
    primary: 'n. 枚举类型',
    pronunciation: { uk: '/ˈiːnəm/', us: '/ˈiːnəm/' },
    forms: ['enum', 'enums'],
    usage: 'enum 给一组相关的常量命名，比裸的整数宏更可读、更好维护。',
    senses: [{ pos: 'n. 编程', meaning: '枚举', example: 'enum state { IDLE, BUSY, DONE };', exampleZh: '定义一个设备状态枚举。' }]
  },
  typedef: {
    primary: 'n. 类型别名  v. 定义类型别名',
    pronunciation: { uk: '/ˈtaɪpdɪf/', us: '/ˈtaɪpdɪf/' },
    forms: ['typedef'],
    usage: 'typedef 为已有类型起别名，可隐藏底层类型或缩短复杂声明。',
    senses: [{ pos: 'n. 编程', meaning: '类型定义', example: 'typedef unsigned long size_t;', exampleZh: '为无符号长整型定义别名 size_t。' }]
  },
  macro: {
    primary: 'n. 宏  adj. 宏观的',
    pronunciation: { uk: '/ˈmækrəʊ/', us: '/ˈmækroʊ/' },
    forms: ['macro', 'macros'],
    usage: '宏由预处理器在编译前展开；注意宏参数求值可能带来副作用。',
    senses: [{ pos: 'n. 编程', meaning: '宏', example: '#define MAX(a, b) ((a) > (b) ? (a) : (b))', exampleZh: '定义一个求最大值的宏。' }]
  },
  header: {
    primary: 'n. 头文件；页眉；排针',
    pronunciation: { uk: '/ˈhedə(r)/', us: '/ˈhedər/' },
    forms: ['header', 'headers'],
    usage: 'C/C++ 头文件声明接口与常量；嵌入式里 header 也指电路板上的排针连接器。',
    senses: [{ pos: 'n. 编程', meaning: '头文件', example: '#include "driver.h"', exampleZh: '包含驱动程序的头文件。' }]
  },
  source: {
    primary: 'n. 源代码；来源；源头',
    pronunciation: { uk: '/sɔːs/', us: '/sɔːrs/' },
    forms: ['source', 'sources'],
    usage: 'source 指程序源代码或数据来源；编译时源文件会被翻译为目标文件。',
    senses: [{ pos: 'n. 编程', meaning: '源代码', example: 'Edit the source and rebuild the image.', exampleZh: '修改源代码后重新构建镜像。' }]
  },
  binary: {
    primary: 'n. 二进制；可执行文件  adj. 二进制的',
    pronunciation: { uk: '/ˈbaɪnəri/', us: '/ˈbaɪnəri/' },
    forms: ['binary', 'binaries'],
    usage: 'binary 指二进制表示，也常指编译生成的可执行文件；固件常以二进制形式烧写。',
    senses: [{ pos: 'n. 编程', meaning: '二进制文件；可执行文件', example: 'The build outputs a binary under out/.', exampleZh: '构建在 out 目录下生成可执行文件。' }]
  },
  executable: {
    primary: 'n. 可执行文件  adj. 可执行的',
    pronunciation: { uk: '/ˈeksɪkjuːtəbl/', us: '/ˈeksɪkjuːtəbl/' },
    forms: ['executable', 'executables'],
    usage: '可执行文件需要可执行权限；Linux 下可用 chmod +x 添加该权限。',
    senses: [{ pos: 'n. 编程', meaning: '可执行文件', example: 'chmod +x install.sh && ./install.sh', exampleZh: '给安装脚本加执行权限并运行。' }]
  },
  object: {
    primary: 'n. 目标文件；对象；物体',
    pronunciation: { uk: '/ˈɒbdʒɪkt/', us: '/ˈɑːbdʒekt/' },
    forms: ['object', 'objects'],
    usage: '编译器把源文件编译成目标文件（.o），再由链接器合并为可执行文件。',
    senses: [{ pos: 'n. 编程', meaning: '目标文件', example: 'The linker merges several .o files.', exampleZh: '链接器把多个目标文件合并。' }]
  },
  linker: {
    primary: 'n. 链接器',
    pronunciation: { uk: '/ˈlɪŋkə(r)/', us: '/ˈlɪŋkər/' },
    forms: ['linker', 'linkers'],
    usage: '链接器把目标文件与库解析合并，生成最终可执行文件或共享库。',
    senses: [{ pos: 'n. 编程', meaning: '链接器', example: 'The linker reports an undefined symbol.', exampleZh: '链接器报出未定义符号。' }]
  },
  syntax: {
    primary: 'n. 语法',
    pronunciation: { uk: '/ˈsɪntæks/', us: '/ˈsɪntæks/' },
    forms: ['syntax'],
    usage: '语法是语言的结构规则；语法错误（syntax error）在编译/解析阶段即可发现。',
    senses: [{ pos: 'n. 编程', meaning: '语法', example: 'The script has a syntax error on line 3.', exampleZh: '脚本第 3 行有语法错误。' }]
  },
  semantic: {
    primary: 'adj. 语义的',
    pronunciation: { uk: '/sɪˈmæntɪk/', us: '/sɪˈmæntɪk/' },
    forms: ['semantic'],
    usage: '语义指代码表达的含义；语法正确但语义错误的 bug 更难排查。',
    senses: [{ pos: 'adj. 编程', meaning: '语义的', example: 'The fix preserves the original semantics.', exampleZh: '该修复保持了原有语义。' }]
  },
  runtime: {
    primary: 'n. 运行时  adj. 运行时的',
    pronunciation: { uk: '/ˈrʌntaɪm/', us: '/ˈrʌntaɪm/' },
    forms: ['runtime'],
    usage: 'runtime 指程序运行期间或支撑运行的库/环境；与编译期（compile-time）相对。',
    senses: [{ pos: 'n. 编程', meaning: '运行时', example: 'The error only appears at runtime.', exampleZh: '该错误只在运行时出现。' }]
  },
  library: {
    primary: 'n. 库；图书馆',
    pronunciation: { uk: '/ˈlaɪbrəri/', us: '/ˈlaɪbreri/' },
    forms: ['library', 'libraries'],
    usage: '库是可复用的代码集合，分静态库（.a）与共享库（.so）；链接时提供符号。',
    senses: [{ pos: 'n. 编程', meaning: '函数库', example: 'Link against the math library -lm.', exampleZh: '链接数学库（-lm）。' }]
  },
  module: {
    primary: 'n. 模块；组件',
    pronunciation: { uk: '/ˈmɒdjuːl/', us: '/ˈmɑːdʒuːl/' },
    forms: ['module', 'modules'],
    usage: 'module 是可独立开发/加载的单元；Linux 内核模块可用 insmod/modprobe 动态加载。',
    senses: [{ pos: 'n. 编程', meaning: '模块', example: 'insmod hello.ko', exampleZh: '加载内核模块 hello.ko。' }]
  },
  dependency: {
    primary: 'n. 依赖；依赖项',
    pronunciation: { uk: '/dɪˈpendənsi/', us: '/dɪˈpendənsi/' },
    forms: ['dependency', 'dependencies'],
    usage: '依赖指构建或运行所必需的其他包/库；缺失依赖是常见的构建失败原因。',
    senses: [{ pos: 'n. 编程', meaning: '依赖项', example: 'Install the missing dependencies first.', exampleZh: '先安装缺失的依赖项。' }]
  },
  package: {
    primary: 'n. 软件包；包裹  v. 打包',
    pronunciation: { uk: '/ˈpækɪdʒ/', us: '/ˈpækɪdʒ/' },
    forms: ['package', 'packages', 'packaged', 'packaging'],
    usage: 'Linux 发行版用包管理工具（apt/dnf）安装、升级和移除软件包。',
    senses: [{ pos: 'n. 系统', meaning: '软件包', example: 'apt install build-essential', exampleZh: '安装编译工具链软件包。' }]
  },
  install: {
    primary: 'v. 安装  n. 安装（过程）',
    pronunciation: { uk: '/ɪnˈstɔːl/', us: '/ɪnˈstɔːl/' },
    forms: ['install', 'installs', 'installed', 'installing'],
    usage: '安装软件、驱动或依赖；编译安装常用 make install 把产物复制到系统目录。',
    senses: [{ pos: 'v. 系统', meaning: '安装', example: 'make && sudo make install', exampleZh: '编译并安装到系统目录。' }]
  },
  uninstall: {
    primary: 'v. 卸载',
    pronunciation: { uk: '/ˌʌnɪnˈstɔːl/', us: '/ˌʌnɪnˈstɔːl/' },
    forms: ['uninstall', 'uninstalls', 'uninstalled', 'uninstalling'],
    usage: '卸载已安装的软件包或驱动，可带走配置；apt remove 与 apt purge 行为不同。',
    senses: [{ pos: 'v. 系统', meaning: '卸载', example: 'sudo apt remove package-name', exampleZh: '卸载指定软件包。' }]
  },
  upgrade: {
    primary: 'v. 升级  n. 升级（版本）',
    pronunciation: { uk: '/ˈʌpɡreɪd/', us: '/ˈʌpɡreɪd/' },
    forms: ['upgrade', 'upgrades', 'upgraded', 'upgrading'],
    usage: '升级软件或固件到新版本；升级前建议备份配置并阅读变更日志。',
    senses: [{ pos: 'v. 系统', meaning: '升级', example: 'sudo apt upgrade -y', exampleZh: '升级系统全部软件包。' }]
  },
  version: {
    primary: 'n. 版本；译本',
    pronunciation: { uk: '/ˈvɜːʃn/', us: '/ˈvɜːrʒn/' },
    forms: ['version', 'versions'],
    usage: '版本号标识软件/固件的发布代次；semver 用 主.次.修订 表示兼容性变化。',
    senses: [{ pos: 'n. 编程', meaning: '版本', example: 'uname -r  # 查看内核版本', exampleZh: '查看当前内核版本。' }]
  },
  release: {
    primary: 'n. 发布版；发布  v. 发布；释放',
    pronunciation: { uk: '/rɪˈliːs/', us: '/rɪˈliːs/' },
    forms: ['release', 'releases', 'released', 'releasing'],
    usage: 'release 指正式发布的版本，也指释放资源（如文件句柄、内存）。',
    senses: [{ pos: 'n. 编程', meaning: '发布版', example: 'This feature ships in the next release.', exampleZh: '该特性将在下一个发布版中提供。' }]
  },
  stable: {
    primary: 'adj. 稳定的；稳固的  n. 稳定版',
    pronunciation: { uk: '/ˈsteɪbl/', us: '/ˈsteɪbl/' },
    forms: ['stable', 'stabler', 'stablest'],
    usage: 'stable 表示稳定、可长期使用；发行版常区分 stable 与 mainline/next 分支。',
    senses: [{ pos: 'adj. 编程', meaning: '稳定的', example: 'Use the stable branch for production.', exampleZh: '生产环境使用稳定分支。' }]
  },
  beta: {
    primary: 'n. 测试版；贝塔  adj. 测试版的',
    pronunciation: { uk: '/ˈbiːtə/', us: '/ˈbeɪtə/' },
    forms: ['beta'],
    usage: 'beta 是正式发布前的公开测试版本，功能接近完成但可能有已知问题。',
    senses: [{ pos: 'n. 编程', meaning: '测试版', example: 'The beta adds support for the new board.', exampleZh: '测试版加入了新板卡支持。' }]
  },
  patch: {
    primary: 'n. 补丁  v. 打补丁；修补',
    pronunciation: { uk: '/pætʃ/', us: '/pætʃ/' },
    forms: ['patch', 'patches', 'patched', 'patching'],
    usage: '补丁以 diff 形式描述代码改动；可用 git apply 或 patch 命令应用。',
    senses: [{ pos: 'n. 编程', meaning: '补丁', example: 'git apply fix.patch', exampleZh: '应用名为 fix.patch 的补丁。' }]
  },
  commit: {
    primary: 'v. 提交  n. 提交（记录）',
    pronunciation: { uk: '/kəˈmɪt/', us: '/kəˈmɪt/' },
    forms: ['commit', 'commits', 'committed', 'committing'],
    usage: 'git commit 把暂存区的改动固化为一条提交记录；提交信息应说明改动意图。',
    senses: [{ pos: 'v. 编程', meaning: '提交（到版本库）', example: 'git commit -m "fix: typo in driver"', exampleZh: '提交一条修复驱动拼写错误的记录。' }]
  },
  branch: {
    primary: 'n. 分支  v. 分支',
    pronunciation: { uk: '/brɑːntʃ/', us: '/bræntʃ/' },
    forms: ['branch', 'branches', 'branched', 'branching'],
    usage: '分支是并行的开发线；git branch 创建/查看分支，checkout 或 switch 切换。',
    senses: [{ pos: 'n. 编程', meaning: '分支', example: 'git checkout -b feature/foo', exampleZh: '创建并切换到新分支 feature/foo。' }]
  },
  merge: {
    primary: 'v. 合并  n. 合并',
    pronunciation: { uk: '/mɜːdʒ/', us: '/mɜːrdʒ/' },
    forms: ['merge', 'merges', 'merged', 'merging'],
    usage: '合并把另一分支的改动并入当前分支；存在冲突时需要手动解决。',
    senses: [{ pos: 'v. 编程', meaning: '合并', example: 'git merge main', exampleZh: '把 main 分支合并到当前分支。' }]
  },
  conflict: {
    primary: 'n. 冲突；矛盾  v. 冲突',
    pronunciation: { uk: '/ˈkɒnflɪkt/', us: '/ˈkɑːnflɪkt/' },
    forms: ['conflict', 'conflicts', 'conflicted', 'conflicting'],
    usage: '合并冲突发生在两侧都改了同一处代码时；需手动编辑并重新提交。',
    senses: [{ pos: 'n. 编程', meaning: '冲突', example: 'Resolve the conflict in main.c first.', exampleZh: '先解决 main.c 里的冲突。' }]
  },
  resolve: {
    primary: 'v. 解决；解析；决定',
    pronunciation: { uk: '/rɪˈzɒlv/', us: '/rɪˈzɑːlv/' },
    forms: ['resolve', 'resolves', 'resolved', 'resolving'],
    usage: '解决冲突/问题；也指把符号、域名解析成地址。',
    senses: [{ pos: 'v. 编程', meaning: '解决（冲突/问题）', example: 'git add main.c && git commit', exampleZh: '标记冲突已解决并提交。' }]
  },
  push: {
    primary: 'v. 推送；压入',
    pronunciation: { uk: '/pʊʃ/', us: '/pʊʃ/' },
    forms: ['push', 'pushes', 'pushed', 'pushing'],
    usage: 'git push 把本地提交推送到远程仓库；数据结构里 push 指把元素压入栈。',
    senses: [{ pos: 'v. 编程', meaning: '推送到远程', example: 'git push origin main', exampleZh: '把本地 main 分支推送到远程。' }]
  },
  pull: {
    primary: 'v. 拉取；下拉；拽',
    pronunciation: { uk: '/pʊl/', us: '/pʊl/' },
    forms: ['pull', 'pulls', 'pulled', 'pulling'],
    usage: 'git pull 拉取远程最新改动并合并；电路里 pull-up/pull-down 是上下拉电阻。',
    senses: [{ pos: 'v. 编程', meaning: '拉取（远程改动）', example: 'git pull --rebase', exampleZh: '拉取远程改动并变基。' }]
  },
  clone: {
    primary: 'v. 克隆；复制  n. 克隆',
    pronunciation: { uk: '/kləʊn/', us: '/kloʊn/' },
    forms: ['clone', 'clones', 'cloned', 'cloning'],
    usage: 'git clone 把远程仓库完整复制到本地，包含历史与所有分支。',
    senses: [{ pos: 'v. 编程', meaning: '克隆（仓库）', example: 'git clone https://example.com/repo.git', exampleZh: '克隆远程仓库到本地。' }]
  },
  diff: {
    primary: 'n. 差异；差别  v. 对比差异',
    pronunciation: { uk: '/dɪf/', us: '/dɪf/' },
    forms: ['diff', 'diffs', 'diffed', 'diffing'],
    usage: 'diff 显示两个文件/版本之间的差异；patch 通常就是 diff 的输出。',
    senses: [{ pos: 'n. 编程', meaning: '差异对比', example: 'git diff HEAD~1 HEAD', exampleZh: '对比最近两次提交的差异。' }]
  },
  test: {
    primary: 'n. 测试  v. 测试；检验',
    pronunciation: { uk: '/test/', us: '/test/' },
    forms: ['test', 'tests', 'tested', 'testing'],
    usage: '测试验证代码行为符合预期；常见有单元测试、集成测试与冒烟测试。',
    senses: [{ pos: 'n. 编程', meaning: '测试', example: 'make test', exampleZh: '运行项目的测试套件。' }]
  },
  integration: {
    primary: 'n. 集成；整合',
    pronunciation: { uk: '/ˌɪntɪˈɡreɪʃn/', us: '/ˌɪntɪˈɡreɪʃn/' },
    forms: ['integration'],
    usage: '集成测试验证模块之间协同工作；持续集成（CI）自动构建并测试每次提交。',
    senses: [{ pos: 'n. 编程', meaning: '集成', example: 'CI runs integration tests on every push.', exampleZh: '持续集成在每次推送时运行集成测试。' }]
  },
  coverage: {
    primary: 'n. 覆盖率；覆盖',
    pronunciation: { uk: '/ˈkʌvərɪdʒ/', us: '/ˈkʌvərɪdʒ/' },
    forms: ['coverage'],
    usage: '测试覆盖率衡量代码被测试执行的比例，高覆盖率不保证没有 bug。',
    senses: [{ pos: 'n. 编程', meaning: '测试覆盖率', example: 'The report shows 85% line coverage.', exampleZh: '报告显示行覆盖率为 85%。' }]
  },
  benchmark: {
    primary: 'n. 基准测试；基准  v. 做基准测试',
    pronunciation: { uk: '/ˈbentʃmɑːk/', us: '/ˈbentʃmɑːrk/' },
    forms: ['benchmark', 'benchmarks', 'benchmarked', 'benchmarking'],
    usage: '基准测试测量性能指标（时间、吞吐量），用于比较优化前后的效果。',
    senses: [{ pos: 'n. 编程', meaning: '基准测试', example: 'Run the benchmark before optimizing.', exampleZh: '优化前先运行基准测试。' }]
  },
  optimize: {
    primary: 'v. 优化',
    pronunciation: { uk: '/ˈɒptɪmaɪz/', us: '/ˈɑːptɪmaɪz/' },
    forms: ['optimize', 'optimizes', 'optimized', 'optimizing'],
    usage: '优化以提升速度、体积或功耗；嵌入式里常用 -O2/-Os 控制编译器优化。',
    senses: [{ pos: 'v. 编程', meaning: '优化', example: 'Compile with -O2 to optimize for speed.', exampleZh: '用 -O2 编译以优化速度。' }]
  },
  refactor: {
    primary: 'v. 重构',
    pronunciation: { uk: '/ˌriːˈfæktə(r)/', us: '/ˌriːˈfæktər/' },
    forms: ['refactor', 'refactors', 'refactored', 'refactoring'],
    usage: '重构在不改变外部行为的前提下改进代码结构，使后续维护更容易。',
    senses: [{ pos: 'v. 编程', meaning: '重构', example: 'Refactor the duplicated logic into a helper.', exampleZh: '把重复逻辑重构为辅助函数。' }]
  },
  deprecate: {
    primary: 'v. 弃用；不推荐使用',
    pronunciation: { uk: '/ˈdeprəkeɪt/', us: '/ˈdeprəkeɪt/' },
    forms: ['deprecate', 'deprecates', 'deprecated', 'deprecating'],
    usage: '弃用的接口仍然可用但不再推荐，后续版本可能移除；通常会有编译警告。',
    senses: [{ pos: 'v. 编程', meaning: '弃用', example: 'This API is deprecated; use the new one.', exampleZh: '该接口已弃用，请使用新接口。' }]
  },
  legacy: {
    primary: 'adj. 遗留的  n. 遗留系统/代码',
    pronunciation: { uk: '/ˈleɡəsi/', us: '/ˈleɡəsi/' },
    forms: ['legacy'],
    usage: 'legacy 指历史遗留但仍需维护的系统或代码，改动风险通常较高。',
    senses: [{ pos: 'adj. 编程', meaning: '遗留的', example: 'We keep the legacy driver for old boards.', exampleZh: '我们保留旧板卡的遗留驱动。' }]
  },
  loop: {
    primary: 'n. 循环  v. 循环',
    pronunciation: { uk: '/luːp/', us: '/luːp/' },
    forms: ['loop', 'loops', 'looped', 'looping'],
    usage: '循环重复执行一段代码；嵌入式主程序常是 while(1) 无限循环。',
    senses: [{ pos: 'n. 编程', meaning: '循环', example: 'for (i = 0; i < n; i++) { ... }', exampleZh: '执行 n 次循环体。' }]
  },
  recursion: {
    primary: 'n. 递归',
    pronunciation: { uk: '/rɪˈkɜːʃn/', us: '/rɪˈkɜːrʒn/' },
    forms: ['recursion'],
    usage: '递归是函数调用自身来解决问题的技术；必须保证有终止条件并防止栈溢出。',
    senses: [{ pos: 'n. 编程', meaning: '递归', example: 'Depth-first search uses recursion.', exampleZh: '深度优先搜索使用递归实现。' }]
  },
  iterate: {
    primary: 'v. 迭代；反复',
    pronunciation: { uk: '/ˈɪtəreɪt/', us: '/ˈɪtəreɪt/' },
    forms: ['iterate', 'iterates', 'iterated', 'iterating'],
    usage: '迭代逐个处理集合中的元素，或反复改进直到满足要求。',
    senses: [{ pos: 'v. 编程', meaning: '迭代', example: 'Iterate over the array with an index.', exampleZh: '用下标遍历数组。' }]
  },
  condition: {
    primary: 'n. 条件；状态  v. 使适应',
    pronunciation: { uk: '/kənˈdɪʃn/', us: '/kənˈdɪʃn/' },
    forms: ['condition', 'conditions', 'conditioned', 'conditioning'],
    usage: '条件控制程序分支；条件变量（condition variable）用于线程间同步。',
    senses: [{ pos: 'n. 编程', meaning: '条件', example: 'The loop exits when the condition is met.', exampleZh: '条件满足时循环退出。' }]
  },
  statement: {
    primary: 'n. 语句；声明；陈述',
    pronunciation: { uk: '/ˈsteɪtmənt/', us: '/ˈsteɪtmənt/' },
    forms: ['statement', 'statements'],
    usage: '语句是程序的最小可执行单位；C 中语句通常以分号结尾。',
    senses: [{ pos: 'n. 编程', meaning: '语句', example: 'An if statement controls the branch.', exampleZh: 'if 语句控制程序分支。' }]
  },
  expression: {
    primary: 'n. 表达式；表达',
    pronunciation: { uk: '/ɪkˈspreʃn/', us: '/ɪkˈspreʃn/' },
    forms: ['expression', 'expressions'],
    usage: '表达式由操作数和运算符组成，求值后产生一个值。',
    senses: [{ pos: 'n. 编程', meaning: '表达式', example: 'a * b + c is a valid expression.', exampleZh: 'a * b + c 是一个合法表达式。' }]
  },
  operator: {
    primary: 'n. 运算符；操作员',
    pronunciation: { uk: '/ˈɒpəreɪtə(r)/', us: '/ˈɑːpəreɪtər/' },
    forms: ['operator', 'operators'],
    usage: '运算符对操作数执行运算，如算术、位、逻辑与赋值运算符。',
    senses: [{ pos: 'n. 编程', meaning: '运算符', example: 'The modulo operator % returns the remainder.', exampleZh: '取模运算符 % 返回余数。' }]
  },
  assignment: {
    primary: 'n. 赋值；任务；分配',
    pronunciation: { uk: '/əˈsaɪnmənt/', us: '/əˈsaɪnmənt/' },
    forms: ['assignment', 'assignments'],
    usage: '赋值把值写入变量；C 里单个等号是赋值，双等号是比较。',
    senses: [{ pos: 'n. 编程', meaning: '赋值', example: 'The assignment copies the value into x.', exampleZh: '赋值把值复制到 x 中。' }]
  },
  declaration: {
    primary: 'n. 声明；宣告',
    pronunciation: { uk: '/ˌdekləˈreɪʃn/', us: '/ˌdekləˈreɪʃn/' },
    forms: ['declaration', 'declarations'],
    usage: '声明告知编译器名字与类型而不分配存储；定义则真正创建对象。',
    senses: [{ pos: 'n. 编程', meaning: '声明', example: 'extern int counter;  // declaration', exampleZh: '声明外部变量 counter。' }]
  },
  definition: {
    primary: 'n. 定义；清晰度',
    pronunciation: { uk: '/ˌdefɪˈnɪʃn/', us: '/ˌdefɪˈnɪʃn/' },
    forms: ['definition', 'definitions'],
    usage: '定义创建实体并分配存储；与声明（declaration）相对。',
    senses: [{ pos: 'n. 编程', meaning: '定义', example: 'The function definition is in main.c.', exampleZh: '函数定义位于 main.c。' }]
  },
  scope: {
    primary: 'n. 作用域；范围',
    pronunciation: { uk: '/skəʊp/', us: '/skoʊp/' },
    forms: ['scope', 'scopes'],
    usage: '作用域决定名字的可见范围；局部变量只在其所在代码块内有效。',
    senses: [{ pos: 'n. 编程', meaning: '作用域', example: 'The variable is out of scope here.', exampleZh: '该变量在此处已超出作用域。' }]
  },
  namespace: {
    primary: 'n. 命名空间',
    pronunciation: { uk: '/ˈneɪmspeɪs/', us: '/ˈneɪmspeɪs/' },
    forms: ['namespace', 'namespaces'],
    usage: '命名空间把名字分组，避免全局命名冲突；C++ 用 namespace 声明。',
    senses: [{ pos: 'n. 编程', meaning: '命名空间', example: 'namespace driver { ... }', exampleZh: '定义名为 driver 的命名空间。' }]
  },
  interface: {
    primary: 'n. 接口；界面',
    pronunciation: { uk: '/ˈɪntəfeɪs/', us: '/ˈɪntərfeɪs/' },
    forms: ['interface', 'interfaces'],
    usage: '接口是组件间约定的交互边界；硬件寄存器、函数签名都是接口。',
    senses: [{ pos: 'n. 编程', meaning: '接口', example: 'The driver implements the netdev interface.', exampleZh: '驱动实现了 netdev 接口。' }]
  },
  implement: {
    primary: 'v. 实现；实施',
    pronunciation: { uk: '/ˈɪmplɪment/', us: '/ˈɪmplɪment/' },
    forms: ['implement', 'implements', 'implemented', 'implementing'],
    usage: '实现把接口或设计变成真实代码；实现应与接口约定保持一致。',
    senses: [{ pos: 'v. 编程', meaning: '实现', example: 'Implement the read callback first.', exampleZh: '先实现读取回调。' }]
  },
  behavior: {
    primary: 'n. 行为；表现',
    pronunciation: { uk: '/bɪˈheɪvjə(r)/', us: '/bɪˈheɪvjər/' },
    forms: ['behavior', 'behaviors'],
    usage: '行为指程序在给定输入下的表现；未定义行为（undefined behavior）应避免。',
    senses: [{ pos: 'n. 编程', meaning: '行为', example: 'The behavior depends on the timing.', exampleZh: '行为取决于时序。' }]
  },
  exception: {
    primary: 'n. 异常；例外',
    pronunciation: { uk: '/ɪkˈsepʃn/', us: '/ɪkˈsepʃn/' },
    forms: ['exception', 'exceptions'],
    usage: '异常是错误处理机制；C++ 用 try/throw/catch 传递异常，C 常用错误码。',
    senses: [{ pos: 'n. 编程', meaning: '异常', example: 'The exception is caught by the handler.', exampleZh: '异常被处理器捕获。' }]
  },
  throw: {
    primary: 'v. 抛出；投掷',
    pronunciation: { uk: '/θrəʊ/', us: '/θroʊ/' },
    forms: ['throw', 'throws', 'threw', 'thrown', 'throwing'],
    usage: '抛出异常中断当前流程，交由调用链上的 catch 处理。',
    senses: [{ pos: 'v. 编程', meaning: '抛出（异常）', example: 'throw std::runtime_error("fail");', exampleZh: '抛出一个运行时错误异常。' }]
  },
  catch: {
    primary: 'v. 捕获；抓住',
    pronunciation: { uk: '/kætʃ/', us: '/kætʃ/' },
    forms: ['catch', 'catches', 'caught', 'catching'],
    usage: '捕获异常并进行处理；也应捕获硬件中断的异步事件。',
    senses: [{ pos: 'v. 编程', meaning: '捕获（异常/中断）', example: 'catch (const std::exception &e) { ... }', exampleZh: '捕获并处理异常。' }]
  },
  argument: {
    primary: 'n. 实参；论点；争吵',
    pronunciation: { uk: '/ˈɑːɡjumənt/', us: '/ˈɑːrɡjumənt/' },
    forms: ['argument', 'arguments'],
    usage: '调用函数时传入的值叫实参（argument），对应定义里的形参（parameter）。',
    senses: [{ pos: 'n. 编程', meaning: '实参', example: 'printf("%d", n) passes n as argument.', exampleZh: 'printf 把 n 作为实参传入。' }]
  },
  overflow: {
    primary: 'n. 溢出  v. 溢出',
    pronunciation: { uk: '/ˌəʊvəˈfləʊ/', us: '/ˌoʊvərˈfloʊ/' },
    forms: ['overflow', 'overflows', 'overflowed', 'overflowing'],
    usage: '溢出是数值超出类型范围，或数据写穿缓冲区边界；可能引发安全漏洞。',
    senses: [{ pos: 'n. 编程', meaning: '溢出', example: 'The buffer overflow corrupts memory.', exampleZh: '缓冲区溢出破坏内存。' }]
  },
  leak: {
    primary: 'v. 泄漏  n. 泄漏（内存/信息）',
    pronunciation: { uk: '/liːk/', us: '/liːk/' },
    forms: ['leak', 'leaks', 'leaked', 'leaking'],
    usage: '内存泄漏指分配的资源未被释放，长期运行后可用内存越来越少。',
    senses: [{ pos: 'n. 编程', meaning: '内存泄漏', example: 'Valgrind reports a small leak.', exampleZh: 'Valgrind 报告一处小的泄漏。' }]
  },
  allocate: {
    primary: 'v. 分配；拨给',
    pronunciation: { uk: '/ˈæləkeɪt/', us: '/ˈæləkeɪt/' },
    forms: ['allocate', 'allocates', 'allocated', 'allocating'],
    usage: '动态分配内存（malloc）或资源；嵌入式里要小心碎片与失败处理。',
    senses: [{ pos: 'v. 编程', meaning: '分配（内存/资源）', example: 'Allocate the buffer at startup.', exampleZh: '启动时分配缓冲区。' }]
  },
  stack: {
    primary: 'n. 栈；堆栈',
    pronunciation: { uk: '/stæk/', us: '/stæk/' },
    forms: ['stack', 'stacks'],
    usage: '栈保存函数调用帧和局部变量；栈溢出常由过深递归或超大局部数组引起。',
    senses: [{ pos: 'n. 编程', meaning: '栈', example: 'Check the stack size for the new task.', exampleZh: '检查新任务的栈大小。' }]
  },
  heap: {
    primary: 'n. 堆；一堆',
    pronunciation: { uk: '/hiːp/', us: '/hiːp/' },
    forms: ['heap', 'heaps'],
    usage: '堆是动态内存区，malloc/new 从中分配；与栈（stack）相对。',
    senses: [{ pos: 'n. 编程', meaning: '堆（动态内存）', example: 'Large objects live on the heap.', exampleZh: '大对象存放在堆上。' }]
  },
  queue: {
    primary: 'n. 队列  v. 排队',
    pronunciation: { uk: '/kjuː/', us: '/kjuː/' },
    forms: ['queue', 'queues', 'queued', 'queuing'],
    usage: '队列是先进先出（FIFO）的数据结构；RTOS 用消息队列在任务间传递数据。',
    senses: [{ pos: 'n. 编程', meaning: '队列', example: 'Send the event to the message queue.', exampleZh: '把事件发送到消息队列。' }]
  },
  callback: {
    primary: 'n. 回调（函数）',
    pronunciation: { uk: '/ˈkɔːlbæk/', us: '/ˈkɔːlbæk/' },
    forms: ['callback', 'callbacks'],
    usage: '回调是由框架在特定事件发生时调用的函数；注意上下文与并发安全。',
    senses: [{ pos: 'n. 编程', meaning: '回调函数', example: 'Register a callback for the button press.', exampleZh: '为按键事件注册回调。' }]
  },
  handler: {
    primary: 'n. 处理程序；处理器',
    pronunciation: { uk: '/ˈhændlə(r)/', us: '/ˈhændlər/' },
    forms: ['handler', 'handlers'],
    usage: 'handler 处理特定事件，如中断处理函数（ISR）或信号处理函数。',
    senses: [{ pos: 'n. 编程', meaning: '事件/中断处理函数', example: 'The IRQ handler must be short and fast.', exampleZh: '中断处理函数必须简短快速。' }]
  },
  null: {
    primary: 'adj. 空的；无效的  n. 空值；空指针',
    pronunciation: { uk: '/nʌl/', us: '/nʌl/' },
    forms: ['null'],
    usage: 'null 表示"没有值"；C 里 NULL 宏常定义为 ((void*)0)，解引用空指针是未定义行为。',
    senses: [{ pos: 'n. 编程', meaning: '空值/空指针', example: 'Check for NULL before dereferencing.', exampleZh: '解引用前先检查是否为空指针。' }]
  },
  return: {
    primary: 'v. 返回  n. 返回值；回车',
    pronunciation: { uk: '/rɪˈtɜːn/', us: '/rɪˈtɜːrn/' },
    forms: ['return', 'returns', 'returned', 'returning'],
    usage: 'return 结束函数并把结果交还调用者；无返回值函数返回 void。',
    senses: [{ pos: 'v. 编程', meaning: '返回', example: 'return -EINVAL;', exampleZh: '返回"参数无效"的错误码。' }]
  },
  // ---------- 2026-08-15 扩充：嵌入式硬件与电子 ----------
  boot: {
    primary: 'v. 启动；引导  n. 启动（过程）',
    pronunciation: { uk: '/buːt/', us: '/buːt/' },
    forms: ['boot', 'boots', 'booted', 'booting'],
    usage: '启动过程从上电到运行系统；嵌入式里 boot 也指 bootloader 引导加载阶段。',
    senses: [{ pos: 'v. 嵌入式', meaning: '启动', example: 'The board boots in under a second.', exampleZh: '这块板卡不到一秒即可启动。' }]
  },
  firmware: {
    primary: 'n. 固件',
    pronunciation: { uk: '/ˈfɜːmweə(r)/', us: '/ˈfɜːrmwer/' },
    forms: ['firmware', 'firmwares'],
    usage: '固件是烧录在非易失存储里的软件，直接驱动硬件；升级固件常通过烧写工具完成。',
    senses: [{ pos: 'n. 嵌入式', meaning: '固件', example: 'Flash the new firmware over USB.', exampleZh: '通过 USB 烧写新固件。' }]
  },
  flash: {
    primary: 'n. 闪存  v. 擦写（固件）；闪现',
    pronunciation: { uk: '/flæʃ/', us: '/flæʃ/' },
    forms: ['flash', 'flashes', 'flashed', 'flashing'],
    usage: 'flash 是掉电不丢失的存储介质；也作动词表示烧写固件。',
    senses: [{ pos: 'n. 嵌入式', meaning: '闪存', example: 'The image is stored on the NOR flash.', exampleZh: '镜像存放在 NOR 闪存中。' }]
  },
  rom: {
    primary: 'abbr. 只读存储器',
    pronunciation: { uk: '/rɒm/', us: '/rɑːm/' },
    forms: ['rom'],
    usage: 'ROM 出厂内容固定，运行时只能读；现在多指"只读"的存储区域，如 boot ROM。',
    senses: [{ pos: 'abbr. 硬件', meaning: '只读存储器（Read-Only Memory）', example: 'The boot ROM runs first after reset.', exampleZh: '复位后首先执行启动 ROM。' }]
  },
  ram: {
    primary: 'abbr. 随机存取存储器',
    pronunciation: { uk: '/ræm/', us: '/ræm/' },
    forms: ['ram'],
    usage: 'RAM 掉电即失，用于存放运行中的代码与数据；SDRAM/DDR 是常见实现。',
    senses: [{ pos: 'abbr. 硬件', meaning: '随机存取存储器（Random-Access Memory）', example: 'The board has 512 MB of DDR RAM.', exampleZh: '板卡配有 512 MB DDR 内存。' }]
  },
  cpu: {
    primary: 'abbr. 中央处理器',
    pronunciation: { uk: '/ˌsiː piː ˈjuː/', us: '/ˌsiː piː ˈjuː/' },
    forms: ['cpu'],
    usage: 'CPU 执行指令并控制整个系统；SoC 中常与 GPU、外设集成在一颗芯片里。',
    senses: [{ pos: 'abbr. 硬件', meaning: '中央处理器（Central Processing Unit）', example: 'The CPU runs at 1 GHz.', exampleZh: 'CPU 运行在 1 GHz。' }]
  },
  dma: {
    primary: 'abbr. 直接内存访问',
    pronunciation: { uk: '/ˌdiː em ˈeɪ/', us: '/ˌdiː em ˈeɪ/' },
    forms: ['dma'],
    usage: 'DMA 让外设与内存之间直接搬运数据，减轻 CPU 负担；传输完成后触发中断。',
    senses: [{ pos: 'abbr. 硬件', meaning: '直接内存访问（Direct Memory Access）', example: 'Use DMA for the large transfer.', exampleZh: '大数据量传输使用 DMA。' }]
  },
  led: {
    primary: 'abbr. 发光二极管',
    pronunciation: { uk: '/ˌel iː ˈdiː/', us: '/ˌel iː ˈdiː/' },
    forms: ['led', 'leds'],
    usage: 'LED 常作为指示灯；驱动时注意极性、限流电阻与 GPIO 的电平逻辑。',
    senses: [{ pos: 'abbr. 硬件', meaning: '发光二极管（Light-Emitting Diode）', example: 'Turn on the LED to show activity.', exampleZh: '点亮 LED 表示工作状态。' }]
  },
  pcb: {
    primary: 'abbr. 印制电路板',
    pronunciation: { uk: '/ˌpiː siː ˈbiː/', us: '/ˌpiː siː ˈbiː/' },
    forms: ['pcb'],
    usage: 'PCB 承载元器件与走线；PCB 版本常印在板面丝印上，驱动和文档会引用它。',
    senses: [{ pos: 'abbr. 硬件', meaning: '印制电路板（Printed Circuit Board）', example: 'Rev B of the PCB fixes the power rail.', exampleZh: 'PCB 的 B 版本修复了电源轨问题。' }]
  },
  sensor: {
    primary: 'n. 传感器',
    pronunciation: { uk: '/ˈsensə(r)/', us: '/ˈsensər/' },
    forms: ['sensor', 'sensors'],
    usage: '传感器把物理量转换为电信号；常见有温度、压力、加速度、光传感器。',
    senses: [{ pos: 'n. 嵌入式', meaning: '传感器', example: 'Read the temperature sensor over I2C.', exampleZh: '通过 I2C 读取温度传感器。' }]
  },
  actuator: {
    primary: 'n. 执行器；致动器',
    pronunciation: { uk: '/ˈæktʃueɪtə(r)/', us: '/ˈæktʃueɪtər/' },
    forms: ['actuator', 'actuators'],
    usage: '执行器把控制信号变成机械动作，如电机、阀门、舵机；与传感器对应。',
    senses: [{ pos: 'n. 嵌入式', meaning: '执行器', example: 'The actuator opens the valve gradually.', exampleZh: '执行器缓慢打开阀门。' }]
  },
  relay: {
    primary: 'n. 继电器；接力  v. 转播',
    pronunciation: { uk: '/ˈriːleɪ/', us: '/ˈriːleɪ/' },
    forms: ['relay', 'relays', 'relayed', 'relaying'],
    usage: '继电器用小电流控制大电流的通断；驱动线圈时需加续流二极管防反电动势。',
    senses: [{ pos: 'n. 电子', meaning: '继电器', example: 'The relay switches the AC load.', exampleZh: '继电器切换交流负载。' }]
  },
  motor: {
    primary: 'n. 电机；马达',
    pronunciation: { uk: '/ˈməʊtə(r)/', us: '/ˈmoʊtər/' },
    forms: ['motor', 'motors'],
    usage: '电机把电能转换为转动；直流电机常用 H 桥驱动并配 PWM 调速。',
    senses: [{ pos: 'n. 电子', meaning: '电机', example: 'PWM controls the motor speed.', exampleZh: '用 PWM 控制电机转速。' }]
  },
  servo: {
    primary: 'n. 伺服（电机）；舵机',
    pronunciation: { uk: '/ˈsɜːvəʊ/', us: '/ˈsɜːrvoʊ/' },
    forms: ['servo', 'servos'],
    usage: '舵机根据脉冲宽度转到指定角度，常见于航模与机械臂。',
    senses: [{ pos: 'n. 电子', meaning: '舵机', example: 'Send a 1.5 ms pulse to center the servo.', exampleZh: '发送 1.5ms 脉宽使舵机回中。' }]
  },
  encoder: {
    primary: 'n. 编码器',
    pronunciation: { uk: '/ɪnˈkəʊdə(r)/', us: '/ɪnˈkoʊdər/' },
    forms: ['encoder', 'encoders'],
    usage: '编码器把旋转或位移转换为数字信号；增量编码器输出 A/B 两路正交脉冲。',
    senses: [{ pos: 'n. 电子', meaning: '编码器', example: 'Count the encoder pulses in the ISR.', exampleZh: '在中断里统计编码器脉冲。' }]
  },
  decoder: {
    primary: 'n. 解码器',
    pronunciation: { uk: '/ˌdiːˈkəʊdə(r)/', us: '/ˌdiːˈkoʊdər/' },
    forms: ['decoder', 'decoders'],
    usage: '解码器把编码信号还原为原始信息；与 encoder 成对出现。',
    senses: [{ pos: 'n. 电子', meaning: '解码器', example: 'The decoder converts the pulses to steps.', exampleZh: '解码器把脉冲转换为步数。' }]
  },
  resistor: {
    primary: 'n. 电阻（器）',
    pronunciation: { uk: '/rɪˈzɪstə(r)/', us: '/rɪˈzɪstər/' },
    forms: ['resistor', 'resistors'],
    usage: '电阻限制电流、分压或上/下拉信号；阻值用色环或丝印标注。',
    senses: [{ pos: 'n. 电子', meaning: '电阻', example: 'Add a pull-up resistor to the line.', exampleZh: '给该信号线加上拉电阻。' }]
  },
  capacitor: {
    primary: 'n. 电容（器）',
    pronunciation: { uk: '/kəˈpæsɪtə(r)/', us: '/kəˈpæsɪtər/' },
    forms: ['capacitor', 'capacitors'],
    usage: '电容存储电荷、滤除噪声；去耦电容应尽量靠近芯片电源引脚。',
    senses: [{ pos: 'n. 电子', meaning: '电容', example: 'Place decoupling capacitors near the IC.', exampleZh: '去耦电容尽量靠近芯片放置。' }]
  },
  inductor: {
    primary: 'n. 电感（器）',
    pronunciation: { uk: '/ɪnˈdʌktə(r)/', us: '/ɪnˈdʌktər/' },
    forms: ['inductor', 'inductors'],
    usage: '电感阻碍电流突变，用于滤波与 DC-DC 变换；电流不可突变是其特征。',
    senses: [{ pos: 'n. 电子', meaning: '电感', example: 'The buck converter needs a bigger inductor.', exampleZh: '降压变换器需要更大的电感。' }]
  },
  diode: {
    primary: 'n. 二极管',
    pronunciation: { uk: '/ˈdaɪəʊd/', us: '/ˈdaɪoʊd/' },
    forms: ['diode', 'diodes'],
    usage: '二极管只允许电流单向通过；续流二极管用来保护继电器/电机驱动。',
    senses: [{ pos: 'n. 电子', meaning: '二极管', example: 'The flyback diode protects the driver.', exampleZh: '续流二极管保护驱动电路。' }]
  },
  transistor: {
    primary: 'n. 晶体管',
    pronunciation: { uk: '/trænˈzɪstə(r)/', us: '/trænˈzɪstər/' },
    forms: ['transistor', 'transistors'],
    usage: '晶体管用作开关或放大；MOSFET 栅极输入阻抗高，常用于电平开关。',
    senses: [{ pos: 'n. 电子', meaning: '晶体管', example: 'The MOSFET switches the LED on and off.', exampleZh: 'MOSFET 控制 LED 的通断。' }]
  },
  connector: {
    primary: 'n. 连接器；接头',
    pronunciation: { uk: '/kəˈnektə(r)/', us: '/kəˈnektər/' },
    forms: ['connector', 'connectors'],
    usage: '连接器提供可插拔的电气接口；选型注意引脚数、间距与机械强度。',
    senses: [{ pos: 'n. 硬件', meaning: '连接器', example: 'Match the connector pin 1 to the board silk.', exampleZh: '连接器 1 脚对准板面丝印。' }]
  },
  cable: {
    primary: 'n. 电缆；线缆',
    pronunciation: { uk: '/ˈkeɪbl/', us: '/ˈkeɪbl/' },
    forms: ['cable', 'cables'],
    usage: '线缆连接设备；USB、排线、同轴各适用于不同场景，注意屏蔽与长度。',
    senses: [{ pos: 'n. 硬件', meaning: '线缆', example: 'Use a shielded cable for the sensor.', exampleZh: '传感器使用屏蔽线缆。' }]
  },
  harness: {
    primary: 'n. 线束；背带',
    pronunciation: { uk: '/ˈhɑːnɪs/', us: '/ˈhɑːrnɪs/' },
    forms: ['harness', 'harnesses'],
    usage: '线束把多根导线按接插件定义捆扎成组；线束编号常对应原理图网络。',
    senses: [{ pos: 'n. 硬件', meaning: '线束', example: 'Label every wire in the harness.', exampleZh: '给线束里的每根线做好标记。' }]
  },
  solder: {
    primary: 'n. 焊锡  v. 焊接',
    pronunciation: { uk: '/ˈsɒldə(r)/', us: '/ˈsɑːdər/' },
    forms: ['solder', 'solders', 'soldered', 'soldering'],
    usage: '焊接把元器件与焊盘固定并导通；注意温度、时间与助焊剂残留。',
    senses: [{ pos: 'v. 电子', meaning: '焊接', example: 'Solder the header pins on the board.', exampleZh: '把排针焊到板子上。' }]
  },
  board: {
    primary: 'n. 电路板；板卡；董事会',
    pronunciation: { uk: '/bɔːd/', us: '/bɔːrd/' },
    forms: ['board', 'boards'],
    usage: 'board 指开发板/电路板；驱动与设备树里常用 board name 区分硬件平台。',
    senses: [{ pos: 'n. 嵌入式', meaning: '电路板；开发板', example: 'Set the board name in the device tree.', exampleZh: '在设备树中设置板卡名称。' }]
  },
  schematic: {
    primary: 'n. 原理图  adj. 概要的',
    pronunciation: { uk: '/skiːˈmætɪk/', us: '/skiːˈmætɪk/' },
    forms: ['schematic', 'schematics'],
    usage: '原理图描述电路连接关系；调试时先查原理图确认引脚与网络。',
    senses: [{ pos: 'n. 电子', meaning: '原理图', example: 'Check the schematic for the pull-up.', exampleZh: '查原理图确认上拉电阻。' }]
  },
  trace: {
    primary: 'n. 走线；踪迹  v. 追踪',
    pronunciation: { uk: '/treɪs/', us: '/treɪs/' },
    forms: ['trace', 'traces', 'traced', 'tracing'],
    usage: 'trace 指 PCB 上的铜走线，也指调试时的调用跟踪（如 strace/ftrace）。',
    senses: [{ pos: 'n. 电子', meaning: '走线', example: 'Keep the high-speed traces short.', exampleZh: '高速走线尽量短。' }]
  },
  ground: {
    primary: 'n. 地（线）；地面  v. 接地',
    pronunciation: { uk: '/ɡraʊnd/', us: '/ɡraʊnd/' },
    forms: ['ground', 'grounds', 'grounded', 'grounding'],
    usage: '地是电路的参考电位（GND）；模拟地与数字地常需单点相连。',
    senses: [{ pos: 'n. 电子', meaning: '地；接地', example: 'Connect the shield to ground.', exampleZh: '把屏蔽层接地。' }]
  },
  voltage: {
    primary: 'n. 电压；电位差',
    pronunciation: { uk: '/ˈvəʊltɪdʒ/', us: '/ˈvoʊltɪdʒ/' },
    forms: ['voltage', 'voltages'],
    usage: '电压是两点间的电位差；ADC 输入不得超过参考电压范围。',
    senses: [{ pos: 'n. 电子', meaning: '电压', example: 'The ADC input range is 0-3.3 V.', exampleZh: 'ADC 输入范围为 0 到 3.3 V。' }]
  },
  current: {
    primary: 'n. 电流；当前  adj. 当前的',
    pronunciation: { uk: '/ˈkʌrənt/', us: '/ˈkɜːrənt/' },
    forms: ['current', 'currents'],
    usage: 'current 指电流，也作"当前的"；注意与"电流方向、额定电流"等搭配。',
    senses: [{ pos: 'n. 电子', meaning: '电流', example: 'The motor draws 2 A at full load.', exampleZh: '电机满载时电流为 2 安培。' }]
  },
  power: {
    primary: 'n. 电源；功率；权力  v. 供电',
    pronunciation: { uk: '/ˈpaʊə(r)/', us: '/ˈpaʊər/' },
    forms: ['power', 'powers', 'powered', 'powering'],
    usage: 'power 表示供电/功率；电源管理（power management）是嵌入式系统的重要部分。',
    senses: [{ pos: 'n. 电子', meaning: '电源；功率', example: 'Measure the power in standby mode.', exampleZh: '测量待机模式下的功耗。' }]
  },
  clock: {
    primary: 'n. 时钟；时钟信号  v. 定时',
    pronunciation: { uk: '/klɒk/', us: '/klɑːk/' },
    forms: ['clock', 'clocks', 'clocked', 'clocking'],
    usage: '时钟同步电路工作节奏；时钟树（clock tree）配置错误会导致外设无法工作。',
    senses: [{ pos: 'n. 电子', meaning: '时钟', example: 'Enable the peripheral clock first.', exampleZh: '先使能外设时钟。' }]
  },
  frequency: {
    primary: 'n. 频率；频繁',
    pronunciation: { uk: '/ˈfriːkwənsi/', us: '/ˈfriːkwənsi/' },
    forms: ['frequency', 'frequencies'],
    usage: '频率是每秒周期数（Hz）；晶振、PWM 与采样率都涉及频率配置。',
    senses: [{ pos: 'n. 电子', meaning: '频率', example: 'Set the PWM frequency to 20 kHz.', exampleZh: '把 PWM 频率设为 20 kHz。' }]
  },
  crystal: {
    primary: 'n. 晶振；晶体',
    pronunciation: { uk: '/ˈkrɪstl/', us: '/ˈkrɪstl/' },
    forms: ['crystal', 'crystals'],
    usage: '晶振提供稳定频率基准；常见 32.768 kHz（RTC）与 8/25 MHz（主时钟）。',
    senses: [{ pos: 'n. 电子', meaning: '晶振', example: 'The RTC uses a 32.768 kHz crystal.', exampleZh: '实时时钟使用 32.768 kHz 晶振。' }]
  },
  oscillator: {
    primary: 'n. 振荡器',
    pronunciation: { uk: '/ˈɒsɪleɪtə(r)/', us: '/ˈɑːsɪleɪtər/' },
    forms: ['oscillator', 'oscillators'],
    usage: '振荡器产生周期性信号；内部 RC 振荡器精度低于外部晶振。',
    senses: [{ pos: 'n. 电子', meaning: '振荡器', example: 'Use the internal oscillator for a first test.', exampleZh: '首次测试先使用内部振荡器。' }]
  },
  signal: {
    primary: 'n. 信号  v. 发信号',
    pronunciation: { uk: '/ˈsɪɡnəl/', us: '/ˈsɪɡnəl/' },
    forms: ['signal', 'signals', 'signaled', 'signaling'],
    usage: '信号是携带信息的变化量；高速信号对阻抗匹配与布线敏感。',
    senses: [{ pos: 'n. 电子', meaning: '信号', example: 'The signal integrity depends on layout.', exampleZh: '信号完整性取决于布线。' }]
  },
  noise: {
    primary: 'n. 噪声；杂音',
    pronunciation: { uk: '/nɔɪz/', us: '/nɔɪz/' },
    forms: ['noise'],
    usage: '噪声干扰信号质量；可通过滤波、屏蔽和合理布线抑制。',
    senses: [{ pos: 'n. 电子', meaning: '噪声', example: 'Filter the noise on the ADC input.', exampleZh: '滤除 ADC 输入上的噪声。' }]
  },
  interference: {
    primary: 'n. 干扰；干涉',
    pronunciation: { uk: '/ˌɪntəˈfɪərəns/', us: '/ˌɪntərˈfɪrəns/' },
    forms: ['interference'],
    usage: '电磁干扰（EMI）可能来自电源或邻近走线；屏蔽与接地是常用对策。',
    senses: [{ pos: 'n. 电子', meaning: '电磁干扰', example: 'The motor causes interference on the sensor.', exampleZh: '电机对传感器产生干扰。' }]
  },
  shield: {
    primary: 'n. 屏蔽；防护罩  v. 屏蔽',
    pronunciation: { uk: '/ʃiːld/', us: '/ʃiːld/' },
    forms: ['shield', 'shields', 'shielded', 'shielding'],
    usage: '屏蔽层阻隔电磁干扰；屏蔽线缆外层导体通常接地。',
    senses: [{ pos: 'n. 电子', meaning: '屏蔽', example: 'The cable shield is grounded at one end.', exampleZh: '线缆屏蔽层在一端接地。' }]
  },
  pin: {
    primary: 'n. 引脚；针脚；大头针',
    pronunciation: { uk: '/pɪn/', us: '/pɪn/' },
    forms: ['pin', 'pins'],
    usage: '引脚是芯片/连接器的引出端；GPIO 引脚可配置为输入、输出或复用功能。',
    senses: [{ pos: 'n. 嵌入式', meaning: '引脚', example: 'Configure the pin as an open-drain output.', exampleZh: '把该引脚配置为开漏输出。' }]
  },
  baud: {
    primary: 'n. 波特（率）',
    pronunciation: { uk: '/bɔːd/', us: '/bɔːd/' },
    forms: ['baud'],
    usage: '波特率是串口每秒符号数；常见 9600/115200，收发双方必须一致。',
    senses: [{ pos: 'n. 通信', meaning: '波特率', example: 'Set the UART baud rate to 115200.', exampleZh: '把串口波特率设为 115200。' }]
  },
  serial: {
    primary: 'adj. 串行的  n. 串口',
    pronunciation: { uk: '/ˈsɪəriəl/', us: '/ˈsɪriəl/' },
    forms: ['serial'],
    usage: '串行通信逐位传输，线少但需同步；UART/SPI/I2C 都属于串行总线。',
    senses: [{ pos: 'adj. 通信', meaning: '串行的', example: 'The console is on serial port 0.', exampleZh: '控制台在串口 0 上。' }]
  },
  parallel: {
    primary: 'adj. 并行的  n. 平行',
    pronunciation: { uk: '/ˈpærəlel/', us: '/ˈpærəlel/' },
    forms: ['parallel'],
    usage: '并行传输一次多位，速度快但线多；现代接口多用高速串行替代。',
    senses: [{ pos: 'adj. 硬件', meaning: '并行的', example: 'The old printer port was parallel.', exampleZh: '老式打印机接口是并行的。' }]
  },
  reset: {
    primary: 'v. 复位；重置  n. 复位',
    pronunciation: { uk: '/ˌriːˈset/', us: '/ˌriːˈset/' },
    forms: ['reset', 'resets', 'reset', 'resetting'],
    usage: '复位让系统回到已知初始状态；复位时序与外设复位引脚要正确配置。',
    senses: [{ pos: 'v. 嵌入式', meaning: '复位', example: 'Hold the reset pin low for 10 ms.', exampleZh: '把复位引脚拉低 10 毫秒。' }]
  },
  sleep: {
    primary: 'v. 休眠；睡觉  n. 休眠',
    pronunciation: { uk: '/sliːp/', us: '/sliːp/' },
    forms: ['sleep', 'sleeps', 'slept', 'sleeping'],
    usage: '低功耗模式下系统进入休眠以省电；唤醒源包括定时器、GPIO 与 RTC。',
    senses: [{ pos: 'v. 嵌入式', meaning: '休眠', example: 'Enter sleep mode to save power.', exampleZh: '进入休眠模式以省电。' }]
  },
  wake: {
    primary: 'v. 唤醒；醒来',
    pronunciation: { uk: '/weɪk/', us: '/weɪk/' },
    forms: ['wake', 'wakes', 'woke', 'woken', 'waking'],
    usage: '唤醒从休眠/待机恢复到运行；需配置唤醒源与中断。',
    senses: [{ pos: 'v. 嵌入式', meaning: '唤醒', example: 'A GPIO edge can wake the system.', exampleZh: 'GPIO 边沿可唤醒系统。' }]
  },
  // ---------- 2026-08-15 扩充：通信总线与网络协议 ----------
  uart: {
    primary: 'abbr. 通用异步收发器（串口）',
    pronunciation: { uk: '/ˌjuː eɪ ɑː ˈtiː/', us: '/ˌjuː eɪ ɑːr ˈtiː/' },
    forms: ['uart', 'uarts'],
    usage: 'UART 是最常用的调试串口；收发双方需约定波特率、数据位与停止位。',
    senses: [{ pos: 'abbr. 通信', meaning: '通用异步收发器（Universal Asynchronous Receiver/Transmitter）', example: 'Log to UART0 at 115200 baud.', exampleZh: '通过 UART0 以 115200 波特率输出日志。' }]
  },
  spi: {
    primary: 'abbr. 串行外设接口',
    pronunciation: { uk: '/ˌes piː ˈaɪ/', us: '/ˌes piː ˈaɪ/' },
    forms: ['spi'],
    usage: 'SPI 是全双工高速串行总线，一主多从，靠片选（CS）选中从设备。',
    senses: [{ pos: 'abbr. 通信', meaning: '串行外设接口（Serial Peripheral Interface）', example: 'The flash chip is on SPI bus 1.', exampleZh: '闪存芯片挂在 SPI 总线 1 上。' }]
  },
  usb: {
    primary: 'abbr. 通用串行总线',
    pronunciation: { uk: '/ˌjuː es ˈbiː/', us: '/ˌjuː es ˈbiː/' },
    forms: ['usb'],
    usage: 'USB 支持设备枚举、热插拔与多种传输类型；U 盘、串口转接都走它。',
    senses: [{ pos: 'abbr. 通信', meaning: '通用串行总线（Universal Serial Bus）', example: 'The board enumerates as a USB device.', exampleZh: '板卡被枚举为一个 USB 设备。' }]
  },
  gpio: {
    primary: 'abbr. 通用输入输出',
    pronunciation: { uk: '/ˌdʒiː piː aɪ ˈəʊ/', us: '/ˌdʒiː piː aɪ ˈoʊ/' },
    forms: ['gpio'],
    usage: 'GPIO 引脚可配置为输入/输出或复用为外设功能；注意上下拉与电平。',
    senses: [{ pos: 'abbr. 嵌入式', meaning: '通用输入输出（General-Purpose Input/Output）', example: 'Drive the GPIO high to enable the LDO.', exampleZh: '把 GPIO 拉高以使能 LDO。' }]
  },
  pwm: {
    primary: 'abbr. 脉宽调制',
    pronunciation: { uk: '/ˌpiː ˌdʌbljuː ˈem/', us: '/ˌpiː ˌdʌbəljuː ˈem/' },
    forms: ['pwm'],
    usage: 'PWM 用占空比控制等效输出，常用于调光、调速与音频。',
    senses: [{ pos: 'abbr. 嵌入式', meaning: '脉宽调制（Pulse-Width Modulation）', example: 'Adjust the duty cycle to dim the LED.', exampleZh: '调节占空比给 LED 调光。' }]
  },
  adc: {
    primary: 'abbr. 模数转换器',
    pronunciation: { uk: '/ˌeɪ diː ˈsiː/', us: '/ˌeɪ diː ˈsiː/' },
    forms: ['adc'],
    usage: 'ADC 把模拟电压转换为数字值；注意参考电压、采样时间与分辨率。',
    senses: [{ pos: 'abbr. 嵌入式', meaning: '模数转换器（Analog-to-Digital Converter）', example: 'Sample the battery voltage with the ADC.', exampleZh: '用 ADC 采样电池电压。' }]
  },
  dac: {
    primary: 'abbr. 数模转换器',
    pronunciation: { uk: '/ˌdiː eɪ ˈsiː/', us: '/ˌdiː eɪ ˈsiː/' },
    forms: ['dac'],
    usage: 'DAC 把数字值转换为模拟电压，用于音频或可调基准输出。',
    senses: [{ pos: 'abbr. 嵌入式', meaning: '数模转换器（Digital-to-Analog Converter）', example: 'The DAC outputs a 1 kHz sine wave.', exampleZh: 'DAC 输出 1 kHz 正弦波。' }]
  },
  tcp: {
    primary: 'abbr. 传输控制协议',
    pronunciation: { uk: '/ˌtiː siː ˈpiː/', us: '/ˌtiː siː ˈpiː/' },
    forms: ['tcp'],
    usage: 'TCP 提供可靠、有序的字节流连接；有握手、重传与拥塞控制。',
    senses: [{ pos: 'abbr. 网络', meaning: '传输控制协议（Transmission Control Protocol）', example: 'Use TCP for reliable file transfer.', exampleZh: '可靠的文件传输使用 TCP。' }]
  },
  udp: {
    primary: 'abbr. 用户数据报协议',
    pronunciation: { uk: '/ˌjuː diː ˈpiː/', us: '/ˌjuː diː ˈpiː/' },
    forms: ['udp'],
    usage: 'UDP 无连接、不保证送达，但开销小、延迟低，适合音视频与广播。',
    senses: [{ pos: 'abbr. 网络', meaning: '用户数据报协议（User Datagram Protocol）', example: 'Broadcast the status via UDP.', exampleZh: '通过 UDP 广播状态。' }]
  },
  dns: {
    primary: 'abbr. 域名系统',
    pronunciation: { uk: '/ˌdiː en ˈes/', us: '/ˌdiː en ˈes/' },
    forms: ['dns'],
    usage: 'DNS 把域名解析为 IP 地址；解析失败常表现为"无法解析主机名"。',
    senses: [{ pos: 'abbr. 网络', meaning: '域名系统（Domain Name System）', example: 'Check the DNS server in /etc/resolv.conf.', exampleZh: '检查 resolv.conf 中的 DNS 服务器。' }]
  },
  dhcp: {
    primary: 'abbr. 动态主机配置协议',
    pronunciation: { uk: '/ˌdiː eɪtʃ siː ˈpiː/', us: '/ˌdiː eɪtʃ siː ˈpiː/' },
    forms: ['dhcp'],
    usage: 'DHCP 自动分配 IP、网关与 DNS；嵌入式设备常先尝试 DHCP 再回退静态地址。',
    senses: [{ pos: 'abbr. 网络', meaning: '动态主机配置协议（Dynamic Host Configuration Protocol）', example: 'The board gets its IP via DHCP.', exampleZh: '板卡通过 DHCP 获取 IP 地址。' }]
  },
  ssh: {
    primary: 'abbr. 安全外壳（协议）',
    pronunciation: { uk: '/ˌes es ˈeɪtʃ/', us: '/ˌes es ˈeɪtʃ/' },
    forms: ['ssh'],
    usage: 'SSH 加密远程登录与文件传输；首次连接需确认主机指纹。',
    senses: [{ pos: 'abbr. 网络', meaning: '安全外壳（Secure Shell）', example: 'ssh root@192.168.1.10', exampleZh: '以 root 远程登录目标设备。' }]
  },
  http: {
    primary: 'abbr. 超文本传输协议',
    pronunciation: { uk: '/ˌeɪtʃ tiː tiː ˈpiː/', us: '/ˌeɪtʃ tiː tiː ˈpiː/' },
    forms: ['http'],
    usage: 'HTTP 是 Web 的基础协议；GET/POST 等方法配合状态码表示请求结果。',
    senses: [{ pos: 'abbr. 网络', meaning: '超文本传输协议（HyperText Transfer Protocol）', example: 'The server returns HTTP 200 OK.', exampleZh: '服务器返回 HTTP 200 OK。' }]
  },
  mtu: {
    primary: 'abbr. 最大传输单元',
    pronunciation: { uk: '/ˌem tiː ˈjuː/', us: '/ˌem tiː ˈjuː/' },
    forms: ['mtu'],
    usage: 'MTU 是链路层单帧最大负载字节数；MTU 不匹配会导致分片或丢包。',
    senses: [{ pos: 'abbr. 网络', meaning: '最大传输单元（Maximum Transmission Unit）', example: 'Reduce the MTU to avoid fragmentation.', exampleZh: '减小 MTU 以避免分片。' }]
  },
  crc: {
    primary: 'abbr. 循环冗余校验',
    pronunciation: { uk: '/ˌsiː ɑː ˈsiː/', us: '/ˌsiː ɑːr ˈsiː/' },
    forms: ['crc'],
    usage: 'CRC 用多项式对数据计算校验值，检测传输错误；不同多项式不能混用。',
    senses: [{ pos: 'abbr. 通信', meaning: '循环冗余校验（Cyclic Redundancy Check）', example: 'Verify the CRC before accepting the frame.', exampleZh: '接收帧前先校验 CRC。' }]
  },
  ethernet: {
    primary: 'n. 以太网',
    pronunciation: { uk: '/ˈiːθənet/', us: '/ˈiːθərnet/' },
    forms: ['ethernet'],
    usage: '以太网是最常见的有线局域网；嵌入式常经 PHY + MAC 接入。',
    senses: [{ pos: 'n. 网络', meaning: '以太网', example: 'Check the Ethernet link status.', exampleZh: '检查以太网链路状态。' }]
  },
  wifi: {
    primary: 'n. 无线局域网；Wi-Fi',
    pronunciation: { uk: '/ˈwaɪfaɪ/', us: '/ˈwaɪfaɪ/' },
    forms: ['wifi'],
    usage: 'Wi-Fi 提供无线网络接入；驱动需处理扫描、认证与漫游。',
    senses: [{ pos: 'n. 网络', meaning: '无线局域网', example: 'The module connects to the Wi-Fi AP.', exampleZh: '模块连接到 Wi-Fi 接入点。' }]
  },
  bluetooth: {
    primary: 'n. 蓝牙',
    pronunciation: { uk: '/ˈbluːtuːθ/', us: '/ˈbluːtuːθ/' },
    forms: ['bluetooth'],
    usage: '蓝牙用于短距无线通信；BLE 功耗更低，适合传感器节点。',
    senses: [{ pos: 'n. 网络', meaning: '蓝牙', example: 'Pair the phone over Bluetooth.', exampleZh: '通过蓝牙与手机配对。' }]
  },
  poll: {
    primary: 'v. 轮询  n. 轮询',
    pronunciation: { uk: '/pəʊl/', us: '/poʊl/' },
    forms: ['poll', 'polls', 'polled', 'polling'],
    usage: '轮询反复查询状态而非等中断；简单但浪费 CPU，常用定时器间隔轮询。',
    senses: [{ pos: 'v. 编程', meaning: '轮询', example: 'Poll the flag every 10 ms.', exampleZh: '每 10 毫秒轮询一次标志位。' }]
  },
  fifo: {
    primary: 'abbr. 先进先出',
    pronunciation: { uk: '/ˈfaɪfəʊ/', us: '/ˈfaɪfoʊ/' },
    forms: ['fifo'],
    usage: 'FIFO 先入先出，用于缓冲数据流或消息队列；也指 Linux 命名管道。',
    senses: [{ pos: 'abbr. 编程', meaning: '先进先出（First In, First Out）队列', example: 'The UART FIFO buffers incoming bytes.', exampleZh: '串口 FIFO 缓存收到的字节。' }]
  },
  checksum: {
    primary: 'n. 校验和',
    pronunciation: { uk: '/ˈtʃeksʌm/', us: '/ˈtʃeksʌm/' },
    forms: ['checksum', 'checksums'],
    usage: '校验和是数据的简单求和值，用于粗检测错误；强度不如 CRC。',
    senses: [{ pos: 'n. 通信', meaning: '校验和', example: 'The bootloader verifies the image checksum.', exampleZh: '引导程序校验镜像的校验和。' }]
  },
  parity: {
    primary: 'n. 奇偶校验；均等',
    pronunciation: { uk: '/ˈpærəti/', us: '/ˈpærəti/' },
    forms: ['parity'],
    usage: '奇偶校验位检测单个比特错误；串口可配置为 none/even/odd。',
    senses: [{ pos: 'n. 通信', meaning: '奇偶校验', example: 'Set parity to none for the console.', exampleZh: '控制台串口校验位设为无。' }]
  },
  payload: {
    primary: 'n. 有效载荷；负载',
    pronunciation: { uk: '/ˈpeɪləʊd/', us: '/ˈpeɪloʊd/' },
    forms: ['payload', 'payloads'],
    usage: 'payload 是数据包中实际承载的数据，不含头部与尾部。',
    senses: [{ pos: 'n. 通信', meaning: '有效载荷', example: 'Parse the payload after the header.', exampleZh: '跳过头部后解析有效载荷。' }]
  },
  packet: {
    primary: 'n. 数据包；分组',
    pronunciation: { uk: '/ˈpækɪt/', us: '/ˈpækɪt/' },
    forms: ['packet', 'packets'],
    usage: '网络数据被分成包传输，含头部与负载；丢包会造成重传或卡顿。',
    senses: [{ pos: 'n. 网络', meaning: '数据包', example: 'Capture packets with tcpdump.', exampleZh: '用 tcpdump 抓取数据包。' }]
  },
  frame: {
    primary: 'n. 帧；框架  v. 构筑',
    pronunciation: { uk: '/freɪm/', us: '/freɪm/' },
    forms: ['frame', 'frames', 'framed', 'framing'],
    usage: '帧是链路层的传输单元（如以太网帧）；也指视频的一帧画面。',
    senses: [{ pos: 'n. 通信', meaning: '数据帧', example: 'The frame contains a 4-byte header.', exampleZh: '该帧包含 4 字节头部。' }]
  },
  protocol: {
    primary: 'n. 协议；规程',
    pronunciation: { uk: '/ˈprəʊtəkɒl/', us: '/ˈproʊtəkɑːl/' },
    forms: ['protocol', 'protocols'],
    usage: '协议约定通信双方的消息格式与交互时序；收发两端必须一致。',
    senses: [{ pos: 'n. 通信', meaning: '协议', example: 'Implement the protocol state machine.', exampleZh: '实现协议状态机。' }]
  },
  handshake: {
    primary: 'n. 握手（过程）',
    pronunciation: { uk: '/ˈhændʃeɪk/', us: '/ˈhændʃeɪk/' },
    forms: ['handshake', 'handshakes'],
    usage: '握手是通信建立前交换参数与确认的过程；TCP 三次握手即一例。',
    senses: [{ pos: 'n. 通信', meaning: '握手', example: 'The TCP handshake takes three packets.', exampleZh: 'TCP 握手需要三个报文。' }]
  },
  host: {
    primary: 'n. 主机  v. 主持',
    pronunciation: { uk: '/həʊst/', us: '/hoʊst/' },
    forms: ['host', 'hosts', 'hosted', 'hosting'],
    usage: '主机是提供服务或发起通信的一方；目标板常与开发主机（host PC）交互。',
    senses: [{ pos: 'n. 网络', meaning: '主机', example: 'The host PC runs the toolchain.', exampleZh: '开发主机上运行工具链。' }]
  },
  target: {
    primary: 'n. 目标（板/设备）；目标',
    pronunciation: { uk: '/ˈtɑːɡɪt/', us: '/ˈtɑːrɡɪt/' },
    forms: ['target', 'targets'],
    usage: 'target 指被开发的硬件平台（目标板），与 host（开发主机）相对。',
    senses: [{ pos: 'n. 嵌入式', meaning: '目标板；目标设备', example: 'Cross-compile for the target board.', exampleZh: '为目标板做交叉编译。' }]
  },
  slave: {
    primary: 'n. 从设备；从机',
    pronunciation: { uk: '/sleɪv/', us: '/sleɪv/' },
    forms: ['slave', 'slaves'],
    usage: 'I2C/SPI 总线中从设备响应主设备发起的传输；由地址或片选区分。',
    senses: [{ pos: 'n. 通信', meaning: '从设备', example: 'Each slave has a unique address.', exampleZh: '每个从设备有唯一地址。' }]
  },
  master: {
    primary: 'n. 主设备  adj. 主要的；精通的',
    pronunciation: { uk: '/ˈmɑːstə(r)/', us: '/ˈmæstər/' },
    forms: ['master', 'masters'],
    usage: '主设备发起总线传输并产生时钟；一个总线上通常只有一个主设备。',
    senses: [{ pos: 'n. 通信', meaning: '主设备', example: 'The MCU is the I2C master.', exampleZh: '单片机是 I2C 主设备。' }]
  },
  peripheral: {
    primary: 'n. 外设；外围设备  adj. 外围的',
    pronunciation: { uk: '/pəˈrɪfərəl/', us: '/pəˈrɪfərəl/' },
    forms: ['peripheral', 'peripherals'],
    usage: '外设包括定时器、UART、ADC 等片上单元或外部器件；驱动需要分别配置。',
    senses: [{ pos: 'n. 嵌入式', meaning: '外设', example: 'Enable the peripheral clock in the DT.', exampleZh: '在设备树中使能外设时钟。' }]
  },
  device: {
    primary: 'n. 设备；器件',
    pronunciation: { uk: '/dɪˈvaɪs/', us: '/dɪˈvaɪs/' },
    forms: ['device', 'devices'],
    usage: 'device 泛指硬件设备；Linux 中设备有对应的设备节点与驱动。',
    senses: [{ pos: 'n. 嵌入式', meaning: '设备', example: 'lsusb lists the USB devices.', exampleZh: 'lsusb 列出 USB 设备。' }]
  },
  transmit: {
    primary: 'v. 发送；传输',
    pronunciation: { uk: '/trænzˈmɪt/', us: '/trænsˈmɪt/' },
    forms: ['transmit', 'transmits', 'transmitted', 'transmitting'],
    usage: '发送数据到对端；与 receive（接收）相对，全双工可同时收发。',
    senses: [{ pos: 'v. 通信', meaning: '发送；传输', example: 'Transmit the packet without delay.', exampleZh: '立即发送该数据包。' }]
  },
  receive: {
    primary: 'v. 接收；收到',
    pronunciation: { uk: '/rɪˈsiːv/', us: '/rɪˈsiːv/' },
    forms: ['receive', 'receives', 'received', 'receiving'],
    usage: '接收对端发来的数据；接收缓冲区满时可能丢数据，需及时处理。',
    senses: [{ pos: 'v. 通信', meaning: '接收', example: 'The handler receives one byte at a time.', exampleZh: '处理函数一次接收一个字节。' }]
  },
  // ---------- 2026-08-15 扩充：Linux 系统与通用技术词 ----------
  mount: {
    primary: 'v. 挂载  n. 挂载点',
    pronunciation: { uk: '/maʊnt/', us: '/maʊnt/' },
    forms: ['mount', 'mounts', 'mounted', 'mounting'],
    usage: '挂载把文件系统接入目录树；U-Boot 与 Linux 里常用 mount 命令挂载分区。',
    senses: [{ pos: 'v. 系统', meaning: '挂载', example: 'mount /dev/mmcblk0p1 /mnt', exampleZh: '把第一个分区挂载到 /mnt。' }]
  },
  unmount: {
    primary: 'v. 卸载（文件系统）',
    pronunciation: { uk: '/ˌʌnˈmaʊnt/', us: '/ˌʌnˈmaʊnt/' },
    forms: ['unmount', 'umount', 'unmounts', 'unmounted', 'unmounting'],
    usage: '卸载前会同步并释放文件系统；Linux 命令写作 umount。',
    senses: [{ pos: 'v. 系统', meaning: '卸载（挂载点）', example: 'umount /mnt', exampleZh: '卸载 /mnt 上的文件系统。' }]
  },
  filesystem: {
    primary: 'n. 文件系统',
    pronunciation: { uk: '/ˈfaɪlsɪstəm/', us: '/ˈfaɪlsɪstəm/' },
    forms: ['filesystem', 'filesystems'],
    usage: '文件系统管理存储上的目录与文件；常见 ext4、fat32、ubifs、jffs2。',
    senses: [{ pos: 'n. 系统', meaning: '文件系统', example: 'The root filesystem is on ext4.', exampleZh: '根文件系统使用 ext4。' }]
  },
  partition: {
    primary: 'n. 分区  v. 分区',
    pronunciation: { uk: '/pɑːˈtɪʃn/', us: '/pɑːrˈtɪʃn/' },
    forms: ['partition', 'partitions', 'partitioned', 'partitioning'],
    usage: '分区把存储划分为独立区域；嵌入式常见 boot 分区、rootfs 分区、数据分区。',
    senses: [{ pos: 'n. 系统', meaning: '分区', example: 'The eMMC has four partitions.', exampleZh: '这块 eMMC 有四个分区。' }]
  },
  format: {
    primary: 'v. 格式化  n. 格式',
    pronunciation: { uk: '/ˈfɔːmæt/', us: '/ˈfɔːrmæt/' },
    forms: ['format', 'formats', 'formatted', 'formatting'],
    usage: '格式化按文件系统要求初始化分区，会清除原有数据；务必确认目标。',
    senses: [{ pos: 'v. 系统', meaning: '格式化', example: 'mkfs.ext4 /dev/mmcblk0p2', exampleZh: '把第二个分区格式化为 ext4。' }]
  },
  erase: {
    primary: 'v. 擦除；抹掉',
    pronunciation: { uk: '/ɪˈreɪz/', us: '/ɪˈreɪs/' },
    forms: ['erase', 'erases', 'erased', 'erasing'],
    usage: '擦除清空存储内容；NOR/NAND 在写入前通常需要先擦除整块/整扇区。',
    senses: [{ pos: 'v. 嵌入式', meaning: '擦除', example: 'Erase the flash before writing.', exampleZh: '写入前先擦除闪存。' }]
  },
  sector: {
    primary: 'n. 扇区；部门',
    pronunciation: { uk: '/ˈsektə(r)/', us: '/ˈsektər/' },
    forms: ['sector', 'sectors'],
    usage: '扇区是存储介质的最小读写单元，通常 512 字节或 4 KB；NAND 按块擦除。',
    senses: [{ pos: 'n. 存储', meaning: '扇区', example: 'Read one sector at a time.', exampleZh: '每次读取一个扇区。' }]
  },
  inode: {
    primary: 'n. 索引节点',
    pronunciation: { uk: '/ˈaɪnəʊd/', us: '/ˈaɪnoʊd/' },
    forms: ['inode', 'inodes'],
    usage: 'inode 记录文件的元数据与数据块位置；inode 耗尽时即使有空间也无法新建文件。',
    senses: [{ pos: 'n. 系统', meaning: '索引节点', example: 'The disk has plenty of inodes left.', exampleZh: '磁盘还剩很多 inode。' }]
  },
  page: {
    primary: 'n. 页（内存）；页面',
    pronunciation: { uk: '/peɪdʒ/', us: '/peɪdʒ/' },
    forms: ['page', 'pages'],
    usage: '内存按页管理，通常 4 KB；缺页（page fault）时内核才把内容调入。',
    senses: [{ pos: 'n. 系统', meaning: '内存页', example: 'The kernel allocates memory in pages.', exampleZh: '内核按页分配内存。' }]
  },
  swap: {
    primary: 'n. 交换分区  v. 交换',
    pronunciation: { uk: '/swɒp/', us: '/swɑːp/' },
    forms: ['swap', 'swaps', 'swapped', 'swapping'],
    usage: '交换区把不活跃的内存页挪到磁盘，释放物理内存；嵌入式常禁用。',
    senses: [{ pos: 'n. 系统', meaning: '交换分区', example: 'Create a swap file of 512 MB.', exampleZh: '创建一个 512 MB 的交换文件。' }]
  },
  virtual: {
    primary: 'adj. 虚拟的',
    pronunciation: { uk: '/ˈvɜːtʃuəl/', us: '/ˈvɜːrtʃuəl/' },
    forms: ['virtual'],
    usage: '虚拟内存让进程拥有独立的地址空间；MMU 完成虚拟地址到物理地址的映射。',
    senses: [{ pos: 'adj. 系统', meaning: '虚拟的', example: 'Each process sees its own virtual memory.', exampleZh: '每个进程看到独立的虚拟内存。' }]
  },
  physical: {
    primary: 'adj. 物理的；实体的',
    pronunciation: { uk: '/ˈfɪzɪkl/', us: '/ˈfɪzɪkl/' },
    forms: ['physical'],
    usage: '物理地址是硬件实际使用的地址；DMA 常直接操作物理地址。',
    senses: [{ pos: 'adj. 系统', meaning: '物理的', example: 'Map the physical address to virtual.', exampleZh: '把物理地址映射为虚拟地址。' }]
  },
  alignment: {
    primary: 'n. 对齐；校准',
    pronunciation: { uk: '/əˈlaɪnmənt/', us: '/əˈlaɪnmənt/' },
    forms: ['alignment'],
    usage: '对齐让数据的起始地址满足类型/总线要求；不对齐访问可能异常或变慢。',
    senses: [{ pos: 'n. 编程', meaning: '对齐', example: 'The struct must be 4-byte aligned.', exampleZh: '该结构体需要 4 字节对齐。' }]
  },
  endian: {
    primary: 'n. 字节序',
    pronunciation: { uk: '/ˈendiən/', us: '/ˈendiən/' },
    forms: ['endian', 'big-endian', 'little-endian'],
    usage: '字节序决定多字节数在内存中的排列；x86 是小端，网络协议通常规定大端。',
    senses: [{ pos: 'n. 编程', meaning: '字节序（大端/小端）', example: 'The protocol uses big-endian fields.', exampleZh: '该协议字段采用大端字节序。' }]
  },
  syscall: {
    primary: 'n. 系统调用',
    pronunciation: { uk: '/ˈsɪskɔːl/', us: '/ˈsɪskɔːl/' },
    forms: ['syscall', 'syscalls'],
    usage: '系统调用是用户态请求内核服务的入口；open/read/ioctl 都是系统调用。',
    senses: [{ pos: 'n. 系统', meaning: '系统调用', example: 'Trace syscalls with strace.', exampleZh: '用 strace 跟踪系统调用。' }]
  },
  daemon: {
    primary: 'n. 守护进程',
    pronunciation: { uk: '/ˈdiːmən/', us: '/ˈdiːmən/' },
    forms: ['daemon', 'daemons'],
    usage: '守护进程在后台长期运行，通常没有终端；服务常由 systemd 管理。',
    senses: [{ pos: 'n. 系统', meaning: '守护进程', example: 'The daemon runs in the background.', exampleZh: '该守护进程在后台运行。' }]
  },
  service: {
    primary: 'n. 服务  v. 服务',
    pronunciation: { uk: '/ˈsɜːvɪs/', us: '/ˈsɜːrvɪs/' },
    forms: ['service', 'services', 'serviced', 'servicing'],
    usage: '服务是持续运行并提供能力的程序或功能；systemctl 可启停系统服务。',
    senses: [{ pos: 'n. 系统', meaning: '服务', example: 'systemctl restart sshd', exampleZh: '重启 SSH 服务。' }]
  },
  background: {
    primary: 'n. 后台；背景',
    pronunciation: { uk: '/ˈbækɡraʊnd/', us: '/ˈbækɡraʊnd/' },
    forms: ['background', 'backgrounds'],
    usage: '后台任务不占用终端；命令后加 & 即可放后台执行。',
    senses: [{ pos: 'n. 系统', meaning: '后台', example: 'Run the build in the background.', exampleZh: '让构建在后台运行。' }]
  },
  foreground: {
    primary: 'n. 前台；前景',
    pronunciation: { uk: '/ˈfɔːɡraʊnd/', us: '/ˈfɔːrɡraʊnd/' },
    forms: ['foreground'],
    usage: '前台任务占据当前终端；fg 命令把后台任务调回前台。',
    senses: [{ pos: 'n. 系统', meaning: '前台', example: 'Bring the job back to the foreground.', exampleZh: '把该任务调回前台。' }]
  },
  session: {
    primary: 'n. 会话；期间',
    pronunciation: { uk: '/ˈseʃn/', us: '/ˈseʃn/' },
    forms: ['session', 'sessions'],
    usage: '会话是登录后的交互上下文；SSH、终端与网卡管理里都常用 session。',
    senses: [{ pos: 'n. 系统', meaning: '会话', example: 'Keep the SSH session alive.', exampleZh: '保持 SSH 会话不断开。' }]
  },
  permission: {
    primary: 'n. 权限；许可',
    pronunciation: { uk: '/pəˈmɪʃn/', us: '/pərˈmɪʃn/' },
    forms: ['permission', 'permissions'],
    usage: '权限控制谁能读/写/执行文件；chmod 用八进制或符号设置权限位。',
    senses: [{ pos: 'n. 系统', meaning: '权限', example: 'Permission denied: check the file mode.', exampleZh: '权限被拒绝，请检查文件权限位。' }]
  },
  ownership: {
    primary: 'n. 所有权；归属',
    pronunciation: { uk: '/ˈəʊnəʃɪp/', us: '/ˈoʊnərʃɪp/' },
    forms: ['ownership'],
    usage: '每个文件有属主与属组；chown 修改归属，常见于设备节点或挂载点。',
    senses: [{ pos: 'n. 系统', meaning: '所有权', example: 'chown root:root /mnt/data', exampleZh: '把目录属主设为 root。' }]
  },
  user: {
    primary: 'n. 用户',
    pronunciation: { uk: '/ˈjuːzə(r)/', us: '/ˈjuːzər/' },
    forms: ['user', 'users'],
    usage: '用户是系统身份的载体；root 拥有最高权限，普通用户权限受限。',
    senses: [{ pos: 'n. 系统', meaning: '用户', example: 'The daemon runs as user root.', exampleZh: '该守护进程以 root 用户运行。' }]
  },
  root: {
    primary: 'n. 根用户；根目录  adj. 根部的',
    pronunciation: { uk: '/ruːt/', us: '/ruːt/' },
    forms: ['root', 'roots'],
    usage: 'root 是超级用户或文件系统根目录 /；rootfs 即根文件系统。',
    senses: [{ pos: 'n. 系统', meaning: '根用户；根目录', example: 'The root filesystem is read-only.', exampleZh: '根文件系统是只读的。' }]
  },
  grant: {
    primary: 'v. 授予；准许',
    pronunciation: { uk: '/ɡrɑːnt/', us: '/ɡrænt/' },
    forms: ['grant', 'grants', 'granted', 'granting'],
    usage: '授予权限或资源；chmod 授权、驱动申请（grant）DMA 通道都用到。',
    senses: [{ pos: 'v. 系统', meaning: '授予', example: 'Grant execute permission to the script.', exampleZh: '给脚本授予执行权限。' }]
  },
  deny: {
    primary: 'v. 拒绝；否认',
    pronunciation: { uk: '/dɪˈnaɪ/', us: '/dɪˈnaɪ/' },
    forms: ['deny', 'denies', 'denied', 'denying'],
    usage: '拒绝访问或请求；访问控制里显式 deny 优先于 allow。',
    senses: [{ pos: 'v. 系统', meaning: '拒绝', example: 'The firewall denies the connection.', exampleZh: '防火墙拒绝该连接。' }]
  },
  access: {
    primary: 'n. 访问；存取  v. 访问',
    pronunciation: { uk: '/ˈækses/', us: '/ˈækses/' },
    forms: ['access', 'accesses', 'accessed', 'accessing'],
    usage: '访问内存、文件或设备；访问控制决定谁有权执行该操作。',
    senses: [{ pos: 'v. 系统', meaning: '访问', example: 'The driver accesses the register directly.', exampleZh: '驱动直接访问该寄存器。' }]
  },
  valid: {
    primary: 'adj. 有效的；合法的',
    pronunciation: { uk: '/ˈvælɪd/', us: '/ˈvælɪd/' },
    forms: ['valid'],
    usage: '有效表示数据或状态可被接受；校验输入与指针是否有效是常见防御。',
    senses: [{ pos: 'adj. 编程', meaning: '有效的', example: 'Check that the pointer is valid first.', exampleZh: '先确认指针有效。' }]
  },
  invalid: {
    primary: 'adj. 无效的；非法的',
    pronunciation: { uk: '/ɪnˈvælɪd/', us: '/ɪnˈvælɪd/' },
    forms: ['invalid'],
    usage: '无效参数/数据应被拒绝并返回错误；内核常用 -EINVAL 表示参数无效。',
    senses: [{ pos: 'adj. 编程', meaning: '无效的', example: 'The driver returns -EINVAL.', exampleZh: '驱动返回"参数无效"。' }]
  },
  status: {
    primary: 'n. 状态；状况',
    pronunciation: { uk: '/ˈsteɪtəs/', us: '/ˈstætəs/' },
    forms: ['status'],
    usage: '状态描述系统或设备的当前情况；状态寄存器与状态码是常见用法。',
    senses: [{ pos: 'n. 编程', meaning: '状态', example: 'Read the status register to check errors.', exampleZh: '读状态寄存器检查错误。' }]
  },
  mode: {
    primary: 'n. 模式；方式',
    pronunciation: { uk: '/məʊd/', us: '/moʊd/' },
    forms: ['mode', 'modes'],
    usage: '模式决定行为方式；如中断模式、低功耗模式、文件权限模式。',
    senses: [{ pos: 'n. 编程', meaning: '模式', example: 'Switch to low-power mode after boot.', exampleZh: '启动后切换到低功耗模式。' }]
  },
  default: {
    primary: 'n. 默认（值）  adj. 默认的',
    pronunciation: { uk: '/dɪˈfɔːlt/', us: '/dɪˈfɔːlt/' },
    forms: ['default', 'defaults'],
    usage: '默认值在未显式指定时生效；配置与命令参数都有默认行为。',
    senses: [{ pos: 'n. 编程', meaning: '默认值', example: 'The default baud rate is 115200.', exampleZh: '默认波特率为 115200。' }]
  },
  option: {
    primary: 'n. 选项；选择',
    pronunciation: { uk: '/ˈɒpʃn/', us: '/ˈɑːpʃn/' },
    forms: ['option', 'options'],
    usage: '命令选项（以 - 或 -- 开头）修改行为；配置项也是 option。',
    senses: [{ pos: 'n. 编程', meaning: '选项', example: 'Run make with the -j option.', exampleZh: '带 -j 选项运行 make。' }]
  },
  feature: {
    primary: 'n. 特性；功能',
    pronunciation: { uk: '/ˈfiːtʃə(r)/', us: '/ˈfiːtʃər/' },
    forms: ['feature', 'features'],
    usage: '特性是软件/硬件提供的功能；内核 Kconfig 里也叫 feature/config。',
    senses: [{ pos: 'n. 编程', meaning: '特性；功能', example: 'This feature is gated by a config option.', exampleZh: '该特性由配置选项控制。' }]
  },
  specify: {
    primary: 'v. 指定；规定',
    pronunciation: { uk: '/ˈspesɪfaɪ/', us: '/ˈspesɪfaɪ/' },
    forms: ['specify', 'specifies', 'specified', 'specifying'],
    usage: '指定参数或要求；文档与接口都需明确说明调用方应提供什么。',
    senses: [{ pos: 'v. 编程', meaning: '指定', example: 'Specify the size in bytes.', exampleZh: '以字节为单位指定大小。' }]
  },
  provide: {
    primary: 'v. 提供；供给',
    pronunciation: { uk: '/prəˈvaɪd/', us: '/prəˈvaɪd/' },
    forms: ['provide', 'provides', 'provided', 'providing'],
    usage: '提供接口、数据或资源；API 文档常用"provides"描述能力。',
    senses: [{ pos: 'v. 编程', meaning: '提供', example: 'The driver provides a read callback.', exampleZh: '驱动提供读取回调。' }]
  },
  support: {
    primary: 'v. 支持  n. 支持',
    pronunciation: { uk: '/səˈpɔːt/', us: '/səˈpɔːrt/' },
    forms: ['support', 'supports', 'supported', 'supporting'],
    usage: '支持某种功能或硬件；内核里"支持"常用 CONFIG_XXX 与 compatible 表示。',
    senses: [{ pos: 'v. 编程', meaning: '支持', example: 'This kernel supports the new board.', exampleZh: '该内核支持新板卡。' }]
  },
  enable: {
    primary: 'v. 启用；使能',
    pronunciation: { uk: '/ɪˈneɪbl/', us: '/ɪˈneɪbl/' },
    forms: ['enable', 'enables', 'enabled', 'enabling'],
    usage: '使能让功能开始工作；外设时钟、中断与配置项都需显式 enable。',
    senses: [{ pos: 'v. 编程', meaning: '启用；使能', example: 'Enable the UART clock in the DT.', exampleZh: '在设备树中使能串口时钟。' }]
  },
  disable: {
    primary: 'v. 禁用；关闭',
    pronunciation: { uk: '/dɪsˈeɪbl/', us: '/dɪsˈeɪbl/' },
    forms: ['disable', 'disables', 'disabled', 'disabling'],
    usage: '禁用功能以省电或避免冲突；与 enable 对应。',
    senses: [{ pos: 'v. 编程', meaning: '禁用', example: 'Disable the watchdog during debug.', exampleZh: '调试期间禁用看门狗。' }]
  },
  configure: {
    primary: 'v. 配置；设置',
    pronunciation: { uk: '/kənˈfɪɡə(r)/', us: '/kənˈfɪɡjər/' },
    forms: ['configure', 'configures', 'configured', 'configuring'],
    usage: '配置指设置参数使硬件/软件按预期工作；menuconfig 配置内核选项即一例。',
    senses: [{ pos: 'v. 编程', meaning: '配置', example: 'Configure the pin as an input.', exampleZh: '把引脚配置为输入。' }]
  },
  configuration: {
    primary: 'n. 配置；布局',
    pronunciation: { uk: '/kənˌfɪɡəˈreɪʃn/', us: '/kənˌfɪɡjəˈreɪʃn/' },
    forms: ['configuration', 'configurations'],
    usage: '配置是一组参数/文件的总和；内核配置文件常叫 .config 或 defconfig。',
    senses: [{ pos: 'n. 编程', meaning: '配置', example: 'Use the default configuration for the board.', exampleZh: '使用该板卡的默认配置。' }]
  },
  request: {
    primary: 'n. 请求  v. 请求',
    pronunciation: { uk: '/rɪˈkwest/', us: '/rɪˈkwest/' },
    forms: ['request', 'requests', 'requested', 'requesting'],
    usage: '请求是向对方索取服务或资源；驱动用 request_irq 注册中断，HTTP 请求同理。',
    senses: [{ pos: 'v. 编程', meaning: '请求', example: 'The driver requests the IRQ line.', exampleZh: '驱动申请该中断线。' }]
  },
  response: {
    primary: 'n. 响应；回复',
    pronunciation: { uk: '/rɪˈspɒns/', us: '/rɪˈspɑːns/' },
    forms: ['response', 'responses'],
    usage: '响应是对请求的回答；超时无响应常意味着对端故障或链路异常。',
    senses: [{ pos: 'n. 通信', meaning: '响应', example: 'No response after the retries.', exampleZh: '重试后仍无响应。' }]
  },
  acknowledge: {
    primary: 'v. 确认；应答',
    pronunciation: { uk: '/əkˈnɒlɪdʒ/', us: '/əkˈnɑːlɪdʒ/' },
    forms: ['acknowledge', 'acknowledges', 'acknowledged', 'acknowledging'],
    usage: '确认表示收到并接受；I2C 的 ACK、TCP 的确认包都是应答机制。',
    senses: [{ pos: 'v. 通信', meaning: '确认；应答', example: 'The device acknowledges the address.', exampleZh: '设备应答其地址。' }]
  },
  latency: {
    primary: 'n. 延迟；等待时间',
    pronunciation: { uk: '/ˈleɪtənsi/', us: '/ˈleɪtənsi/' },
    forms: ['latency'],
    usage: '延迟是请求到响应的时间；中断延迟、网络延迟直接影响实时性。',
    senses: [{ pos: 'n. 系统', meaning: '延迟', example: 'Reduce the interrupt latency.', exampleZh: '降低中断延迟。' }]
  },
  throughput: {
    primary: 'n. 吞吐量',
    pronunciation: { uk: '/ˈθruːpʊt/', us: '/ˈθruːpʊt/' },
    forms: ['throughput'],
    usage: '吞吐量是单位时间处理的数据量，与延迟（latency）不同。',
    senses: [{ pos: 'n. 系统', meaning: '吞吐量', example: 'The DMA improves the throughput.', exampleZh: 'DMA 提升了吞吐量。' }]
  },
  bandwidth: {
    primary: 'n. 带宽',
    pronunciation: { uk: '/ˈbændwɪdθ/', us: '/ˈbændwɪdθ/' },
    forms: ['bandwidth'],
    usage: '带宽指单位时间可传输的数据量；总线与网络的带宽决定性能上限。',
    senses: [{ pos: 'n. 网络', meaning: '带宽', example: 'The link bandwidth is 1 Gbps.', exampleZh: '链路带宽为 1 Gbps。' }]
  },
  gateway: {
    primary: 'n. 网关',
    pronunciation: { uk: '/ˈɡeɪtweɪ/', us: '/ˈɡeɪtweɪ/' },
    forms: ['gateway', 'gateways'],
    usage: '网关连接不同网络段，是跨网通信的出口；默认路由指向网关。',
    senses: [{ pos: 'n. 网络', meaning: '网关', example: 'Set the default gateway address.', exampleZh: '设置默认网关地址。' }]
  },
  subnet: {
    primary: 'n. 子网',
    pronunciation: { uk: '/ˈsʌbnet/', us: '/ˈsʌbnet/' },
    forms: ['subnet', 'subnets'],
    usage: '子网由网络地址与掩码界定；同子网内通信不需要网关。',
    senses: [{ pos: 'n. 网络', meaning: '子网', example: 'Both hosts are on the same subnet.', exampleZh: '两台主机在同一子网。' }]
  },
  netmask: {
    primary: 'n. 子网掩码',
    pronunciation: { uk: '/ˈnetmɑːsk/', us: '/ˈnetmæsk/' },
    forms: ['netmask'],
    usage: '子网掩码区分网络位与主机位；常见 255.255.255.0 或 /24。',
    senses: [{ pos: 'n. 网络', meaning: '子网掩码', example: 'Use netmask 255.255.255.0.', exampleZh: '使用 255.255.255.0 作为掩码。' }]
  },
  router: {
    primary: 'n. 路由器',
    pronunciation: { uk: '/ˈruːtə(r)/', us: '/ˈraʊtər/' },
    forms: ['router', 'routers'],
    usage: '路由器根据路由表转发数据包；嵌入式设备常兼作网关或路由。',
    senses: [{ pos: 'n. 网络', meaning: '路由器', example: 'The router forwards packets between nets.', exampleZh: '路由器在网络间转发数据包。' }]
  },
  firewall: {
    primary: 'n. 防火墙',
    pronunciation: { uk: '/ˈfaɪəwɔːl/', us: '/ˈfaɪərwɔːl/' },
    forms: ['firewall', 'firewalls'],
    usage: '防火墙按规则放行或拒绝流量；iptables/nftables 是常见实现。',
    senses: [{ pos: 'n. 网络', meaning: '防火墙', example: 'The firewall blocks port 22.', exampleZh: '防火墙拦截 22 端口。' }]
  },
  log: {
    primary: 'n. 日志  v. 记录日志',
    pronunciation: { uk: '/lɒɡ/', us: '/lɑːɡ/' },
    forms: ['log', 'logs', 'logged', 'logging'],
    usage: '日志记录运行过程与错误；内核日志用 dmesg 查看，U-Boot 打印到串口。',
    senses: [{ pos: 'n. 系统', meaning: '日志', example: 'Check dmesg for the driver error.', exampleZh: '用 dmesg 查看驱动报错。' }]
  },
  error: {
    primary: 'n. 错误  v. 出错',
    pronunciation: { uk: '/ˈerə(r)/', us: '/ˈerər/' },
    forms: ['error', 'errors', 'errored', 'erroring'],
    usage: '错误表示操作未按预期完成；错误码与错误日志是定位问题的主要线索。',
    senses: [{ pos: 'n. 编程', meaning: '错误', example: 'The driver returns an error on timeout.', exampleZh: '超时后驱动返回错误。' }]
  },
  warning: {
    primary: 'n. 警告',
    pronunciation: { uk: '/ˈwɔːnɪŋ/', us: '/ˈwɔːrnɪŋ/' },
    forms: ['warning', 'warnings'],
    usage: '警告提示潜在问题但不中断执行；编译警告常预示隐患。',
    senses: [{ pos: 'n. 编程', meaning: '警告', example: 'The build shows a missing-prototype warning.', exampleZh: '构建出现缺少原型的警告。' }]
  },
  message: {
    primary: 'n. 消息；信息',
    pronunciation: { uk: '/ˈmesɪdʒ/', us: '/ˈmesɪdʒ/' },
    forms: ['message', 'messages'],
    usage: '消息是传递的信息单元；队列、邮件与日志中都很常见。',
    senses: [{ pos: 'n. 编程', meaning: '消息', example: 'Send a message to the queue.', exampleZh: '向队列发送一条消息。' }]
  },
  document: {
    primary: 'n. 文档  v. 编写文档',
    pronunciation: { uk: '/ˈdɒkjumənt/', us: '/ˈdɑːkjumənt/' },
    forms: ['document', 'documents', 'documented', 'documenting'],
    usage: '文档记录设计、接口与用法；内核源码树含大量 .rst 文档。',
    senses: [{ pos: 'n. 编程', meaning: '文档', example: 'Document the new DT binding.', exampleZh: '为新设备树绑定编写文档。' }]
  },
  manual: {
    primary: 'n. 手册  adj. 手动的',
    pronunciation: { uk: '/ˈmænjuəl/', us: '/ˈmænjuəl/' },
    forms: ['manual', 'manuals'],
    usage: '手册是使用或参考说明；芯片手册（datasheet）与 man 命令都是 manual。',
    senses: [{ pos: 'n. 通用', meaning: '手册', example: 'Read the manual for the exact timing.', exampleZh: '查阅手册确认具体时序。' }]
  },
  datasheet: {
    primary: 'n. 数据手册',
    pronunciation: { uk: '/ˈdeɪtəʃiːt/', us: '/ˈdeɪtəʃiːt/' },
    forms: ['datasheet', 'datasheets'],
    usage: '数据手册给出芯片的电气参数、寄存器与时序；驱动开发必备。',
    senses: [{ pos: 'n. 硬件', meaning: '数据手册', example: 'Check the datasheet for the register map.', exampleZh: '查数据手册确认寄存器映射。' }]
  },
  specification: {
    primary: 'n. 规范；规格',
    pronunciation: { uk: '/ˌspesɪfɪˈkeɪʃn/', us: '/ˌspesɪfɪˈkeɪʃn/' },
    forms: ['specification', 'specifications'],
    usage: '规范约定接口或协议的标准要求；实现必须与规范保持一致。',
    senses: [{ pos: 'n. 编程', meaning: '规范', example: 'The implementation follows the spec.', exampleZh: '实现遵循规范。' }]
  },
  reference: {
    primary: 'n. 参考；引用',
    pronunciation: { uk: '/ˈrefrəns/', us: '/ˈrefrəns/' },
    forms: ['reference', 'references'],
    usage: '引用指向某对象或资源；C++ 引用、文档引用、参考设计都是 reference。',
    senses: [{ pos: 'n. 编程', meaning: '参考；引用', example: 'Pass the buffer by reference.', exampleZh: '以引用方式传入缓冲区。' }]
  },
  ensure: {
    primary: 'v. 确保；保证',
    pronunciation: { uk: '/ɪnˈʃʊə(r)/', us: '/ɪnˈʃʊr/' },
    forms: ['ensure', 'ensures', 'ensured', 'ensuring'],
    usage: '确保指采取行动保证某条件成立；文档与代码注释中很常见。',
    senses: [{ pos: 'v. 通用', meaning: '确保', example: 'Ensure the clock is enabled first.', exampleZh: '确保时钟已先使能。' }]
  },
  require: {
    primary: 'v. 需要；要求',
    pronunciation: { uk: '/rɪˈkwaɪə(r)/', us: '/rɪˈkwaɪər/' },
    forms: ['require', 'requires', 'required', 'requiring'],
    usage: '需要表示某项前提或依赖；文档常用 "requires" 说明使用条件。',
    senses: [{ pos: 'v. 通用', meaning: '需要；要求', example: 'The driver requires a 3.3 V supply.', exampleZh: '驱动需要 3.3V 供电。' }]
  }
};
