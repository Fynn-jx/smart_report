-- ============================================
-- 文献管理系统（本地存储模式）- 数据库表结构
-- 只存储文档索引，不存储实际文件
-- ============================================

-- ============= 创建文档索引表 =============
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',

    -- 文档信息（只存元数据）
    title VARCHAR(500) NOT NULL,
    filename VARCHAR(500),
    local_path VARCHAR(1000),         -- 本地文件路径（用于记录）
    file_size BIGINT,
    file_type VARCHAR(20),

    -- 来源信息
    source_url TEXT,                  -- 来自哪个网页
    source_type VARCHAR(50),          -- plugin/manual/upload

    -- 用户数据
    tags TEXT[],                      -- 标签数组
    notes TEXT,                       -- 笔记
    folder VARCHAR(200) DEFAULT '未分类',

    -- 关联的处理任务
    conversion_history TEXT,          -- 关联的转换记录ID列表

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);


-- ============= 创建文件夹表 =============
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
    name VARCHAR(200) NOT NULL,
    parent_id VARCHAR(100),            -- 父文件夹ID
    color VARCHAR(20),                 -- 文件夹颜色标记
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);


-- ============= 启用 RLS =============
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;


-- ============= 创建宽松的安全策略 =============
DROP POLICY IF EXISTS "Enable all for documents" ON documents;
DROP POLICY IF EXISTS "Enable all for folders" ON folders;

CREATE POLICY "Enable all for documents" ON documents
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for folders" ON folders
    FOR ALL USING (true) WITH CHECK (true);


-- ============= 添加注释 =============
COMMENT ON TABLE documents IS '文档索引表（本地存储模式 - 只存元数据）';
COMMENT ON COLUMN documents.local_path IS '本地文件路径（仅用于记录，实际访问由用户选择）';
COMMENT ON COLUMN documents.source_url IS '文档来源URL（浏览器插件保存时记录）';
COMMENT ON COLUMN documents.tags IS '标签数组，用于分类和搜索';
COMMENT ON TABLE folders IS '文件夹组织结构';


-- ============= 完成提示 =============
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '文档索引表创建完成（本地存储模式）';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '说明：';
    RAISE NOTICE '- 只存储文档元数据，不存储实际文件';
    RAISE NOTICE '- 文件保存在用户本地电脑';
    RAISE NOTICE '- 浏览器插件下载文件到本地';
    RAISE NOTICE '- 前端显示索引，用户手动选择文件处理';
    RAISE NOTICE '===========================================';
END $$;
