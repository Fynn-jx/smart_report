#!/usr/bin/env python3
"""
反馈功能测试脚本
用于快速验证反馈API是否正常工作
"""

import requests
import json

API_BASE = 'http://localhost:5000/api'

def test_health():
    """测试健康检查"""
    print("\n🔍 测试健康检查...")
    try:
        response = requests.get(f'{API_BASE}/health', timeout=5)
        if response.status_code == 200:
            print("✅ 健康检查通过")
            return True
        else:
            print(f"❌ 健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 无法连接到服务器: {e}")
        return False

def test_submit_feedback():
    """测试提交反馈"""
    print("\n📝 测试提交反馈...")
    try:
        test_feedback = {
            "type": "suggestion",
            "content": "这是一条测试反馈，用于验证API是否正常工作",
            "contact": "test@example.com"
        }

        response = requests.post(
            f'{API_BASE}/feedback',
            json=test_feedback,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"✅ 反馈提交成功")
                print(f"   反馈ID: {data.get('feedback_id')}")
                return data.get('feedback_id')
            else:
                print(f"❌ 提交失败: {data.get('error')}")
                return None
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ 提交失败: {e}")
        return None

def test_get_feedbacks():
    """测试获取反馈列表"""
    print("\n📋 测试获取反馈列表...")
    try:
        response = requests.get(f'{API_BASE}/feedback', timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                count = data.get('count', 0)
                print(f"✅ 成功获取反馈列表")
                print(f"   总数: {count} 条")

                if count > 0:
                    print("\n   最新的3条反馈:")
                    for fb in data.get('feedbacks', [])[:3]:
                        print(f"   - [{fb.get('type_label')}] {fb.get('content')[:50]}...")

                return True
            else:
                print(f"❌ 获取失败: {data.get('error')}")
                return False
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取失败: {e}")
        return False

def test_get_stats():
    """测试获取统计信息"""
    print("\n📊 测试获取统计信息...")
    try:
        response = requests.get(f'{API_BASE}/feedback/stats', timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                stats = data.get('stats', {})
                print("✅ 成功获取统计信息")
                print(f"   总反馈数: {stats.get('total', 0)}")
                print(f"   待处理: {stats.get('by_status', {}).get('pending', 0)}")
                print(f"   已查看: {stats.get('by_status', {}).get('reviewed', 0)}")
                print(f"   已解决: {stats.get('by_status', {}).get('resolved', 0)}")
                return True
            else:
                print(f"❌ 获取失败: {data.get('error')}")
                return False
        else:
            print(f"❌ HTTP错误: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 获取失败: {e}")
        return False

def main():
    """主测试函数"""
    print("=" * 60)
    print("反馈功能测试")
    print("=" * 60)
    print(f"API地址: {API_BASE}")

    # 运行所有测试
    results = []
    results.append(("健康检查", test_health()))

    # 只有健康检查通过才继续测试
    if results[0][1]:
        feedback_id = test_submit_feedback()
        results.append(("提交反馈", feedback_id is not None))

        if feedback_id:
            results.append(("获取反馈列表", test_get_feedbacks()))
            results.append(("获取统计信息", test_get_stats()))

    # 打印测试结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)

    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name}: {status}")

    # 总结
    passed = sum(1 for _, result in results if result)
    total = len(results)

    print("\n" + "=" * 60)
    if passed == total:
        print(f"🎉 所有测试通过! ({passed}/{total})")
        print("\n反馈功能已就绪，可以正常使用！")
        print("打开 feedback_admin.html 查看管理员后台")
    else:
        print(f"⚠️  部分测试失败 ({passed}/{total})")
        print("\n请检查：")
        print("1. 后端服务是否正在运行（python dify_backend.py）")
        print("2. 服务端口是否为 5000")
        print("3. 防火墙是否阻止了连接")

    print("=" * 60)

if __name__ == '__main__':
    main()
