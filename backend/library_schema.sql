-- ============================================
-- 文档库数据库表结构 (参考 Zotero)
-- ============================================

-- ============= 1. 文件夹表 (类似 Zotero 的 Collections) =============
CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
    name VARCHAR(200) NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    parent_id VARCHAR(100),  -- 支持嵌套文件夹
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- ============= 2. 文档表 (类似 Zotero 的 Items) =============
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',

    -- 基本信息
    title VARCHAR(500) NOT NULL,
    filename VARCHAR(500),
    file_path TEXT,
    file_url TEXT,
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(20),  -- pdf, doc, docx, txt, etc.

    -- 来源信息
    source_type VARCHAR(20) DEFAULT 'upload',  -- plugin(网页插件), manual(手动上传), upload(转换生成)
    source_url TEXT,

    -- 元数据 (类似 Zotero 的 extra 字段，存储 JSON)
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    abstract TEXT,

    -- 文件夹 (类似 Zotero 的 collections)
    folder VARCHAR(200) DEFAULT '未分类',

    -- 引用信息 (类似 Zotero 的 citations)
    authors TEXT[],
    publication_year INT,
    journal VARCHAR(500),
    doi VARCHAR(200),
    url TEXT,

    -- 状态
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_is_starred ON documents(is_starred);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- ============= 3. 启用行级安全策略 =============
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ============= 4. 文件夹策略 =============
CREATE POLICY "Users can manage own folders"
    ON folders FOR ALL
    USING (user_id = current_setting('app.current_user_id', true) OR user_id = 'default')
    WITH CHECK (user_id = current_setting('app.current_user_id', true) OR user_id = 'default');

-- ============= 5. 文档策略 =============
CREATE POLICY "Users can manage own documents"
    ON documents FOR ALL
    USING (user_id = current_setting('app.current_user_id', true) OR user_id = 'default')
    WITH CHECK (user_id = current_setting('app.current_user_id', true) OR user_id = 'default');

-- ============= 6. 初始默认文件夹 =============
INSERT INTO folders (id, user_id, name, color, sort_order) VALUES
    ('folder_default_1', 'default', '金融经济', '#059669', 0),
    ('folder_default_2', 'default', '国际贸易', '#2563EB', 1),
    ('folder_default_3', 'default', '国际关系', '#DC2626', 2),
    ('folder_default_4', 'default', '法律政策', '#7C3AED', 3),
    ('folder_default_5', 'default', '统计资料', '#0891B2', 4),
    ('folder_default_6', 'default', '其他', '#6B7280', 5)
ON CONFLICT (id) DO NOTHING;

-- ============= 7. 注释 =============
COMMENT ON TABLE folders IS '文件夹表 - 类似 Zotero 的 Collections';
COMMENT ON TABLE documents IS '文档表 - 类似 Zotero 的 Items';

COMMENT ON COLUMN documents.source_type IS '来源类型: plugin(网页插件), manual(手动上传), upload(转换生成)';
COMMENT ON COLUMN documents.folder IS '所属文件夹名称';
COMMENT ON COLUMN documents.tags IS '标签数组';
