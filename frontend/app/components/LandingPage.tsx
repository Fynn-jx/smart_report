import { FileText, Globe, Image, ArrowRight, CheckCircle } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const features = [
    {
      icon: FileText,
      title: '学术报告转公文',
      description: '自动将学术研究报告转换为规范的公文格式',
    },
    {
      icon: Globe,
      title: '国别研究报告',
      description: '快速生成专业的国别情况分析和季度研究报告',
    },
    {
      icon: Image,
      title: '图片智能转译',
      description: '支持多种格式图片的智能识别和转译处理',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-25 h-25">
                <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-medium text-foreground">中国人民银行智能公文系统</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                功能介绍
              </a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                关于我们
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                定价
              </a>
            </div>

            <button
              onClick={onGetStarted}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              登录系统
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              中国人民银行智能公文系统
            </div>
            
            <h1 className="text-5xl md:text-6xl leading-tight text-foreground">
              高效处理
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                公文写作
              </span>
              <br />
              智能化转译
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed">
              基于先进的AI技术，为您提供专业的学术报告转换、国别研究分析和图片智能转译服务。让公文写作更简单、更高效。
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={onGetStarted}
                className="group flex items-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all"
              >
                <span>立即开始</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 rounded-lg border-2 border-border hover:border-primary/50 transition-colors">
                了解更多
              </button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">AI驱动</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">高效准确</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">安全可靠</span>
              </div>
            </div>
          </div>

          {/* Right Illustration */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-3xl" />
            <div className="relative bg-card border border-border rounded-3xl p-8 shadow-2xl">
              {/* 系统工作流程图 */}
              <div className="w-full h-64 rounded-2xl overflow-hidden">
                <img 
                  src="/images/Landpage.png" 
                  alt="系统工作流程图" 
                  className="w-full h-full object-contain"
                />
              </div>
              
              {/* Floating cards */}
              <div className="absolute -top-6 -left-6 bg-card border border-border rounded-xl px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-foreground">系统运行中</span>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-6 bg-card border border-border rounded-xl px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">1000+ 文档处理</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/30 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="mb-4">核心功能</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              我们提供三大核心功能，帮助您轻松完成各类公文处理任务
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-all hover:-translate-y-1"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-6">关于我们</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  我们致力于通过AI技术提升公文处理效率，为中国人民银行提供专业的智能化解决方案。
                </p>
                <p>
                  系统基于Dify工作流引擎，结合先进的自然语言处理技术，能够准确理解文档内容，自动生成符合规范的公文格式。
                </p>
                <p>
                  我们的目标是让公文写作变得更简单、更高效，让用户能够专注于内容本身，提高撰写效率和报告深度。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="text-4xl font-medium text-primary mb-2">1000+</div>
                <div className="text-muted-foreground">文档处理</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="text-4xl font-medium text-primary mb-2">30+</div>
                <div className="text-muted-foreground">支持国家</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="text-4xl font-medium text-primary mb-2">99.9%</div>
                <div className="text-muted-foreground">系统可用性</div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="text-4xl font-medium text-primary mb-2">24/7</div>
                <div className="text-muted-foreground">技术支持</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="mb-4">准备开始了吗？</h2>
          <p className="text-muted-foreground text-xl mb-8">
            立即登录系统，体验智能化的公文处理服务
          </p>
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all"
          >
            <span>立即登录</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-muted-foreground">© 2026 公文撰写系统. All rights reserved.</span>
            </div>
            <div className="flex gap-6 text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">隐私政策</a>
              <a href="#" className="hover:text-foreground transition-colors">服务条款</a>
              <a href="#" className="hover:text-foreground transition-colors">联系我们</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
