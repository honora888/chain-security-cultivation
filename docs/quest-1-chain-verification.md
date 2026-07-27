# Quest 1 Monad Testnet Read-only Verification

## 验收目标

本记录用于说明 Quest 1 在 Monad Testnet 上的真实只读验收范围，以及真实 RPC 验证与本地受控 Mock 验证的边界。

验收对象是 `ACT6_COMPLETE` 之后提供的 GuardianQuest 状态查询。该查询不会改变 Boss HP、EXP、水属性熟练度、本地徽记、异兽志或任何链上状态。

## 合约与网络

| 字段 | 值 |
|---|---|
| 网络 | Monad Testnet |
| Chain ID | `10143` |
| Chain ID（十六进制） | `0x279f` |
| GuardianQuest | `0x131DEbd042208A327841128e5800dd4a833032ab` |
| Quest ID | `1` |
| 公共测试地址 | `0x000000000000000000000000000000000000dEaD` |

GuardianQuest 地址与 Chain ID 来自当前仓库的合约、部署记录和前端只读查询实现。

## 真实查询环境

本次验收通过项目的 Next.js Route Handler 访问 Monad Testnet：

```text
GET /api/quest-1/chain-status?address=0x...
```

查询使用服务端配置的固定 RPC、固定 GuardianQuest 合约和固定只读方法。浏览器不能指定 RPC URL、合约地址、JSON-RPC method 或 calldata。

服务端依次执行：

1. `eth_chainId`
2. `eth_blockNumber`
3. 三个使用同一 block tag 的 `eth_call`

## 实际 API 请求

请求路径：

```text
/api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD
```

HTTP 状态：

```text
200
```

实际查询区块：

```text
48528289
```

## 实际返回结果

```json
{
  "ok": true,
  "network": {
    "name": "Monad Testnet",
    "chainId": 10143
  },
  "contract": {
    "address": "0x131DEbd042208A327841128e5800dd4a833032ab"
  },
  "query": {
    "address": "0x000000000000000000000000000000000000dEaD",
    "questId": 1
  },
  "status": {
    "completed": false,
    "reportHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "badgeBalance": "0"
  },
  "blockNumber": "48528289"
}
```

## 结果解释

- `completed=false`：该公共测试地址尚未在 GuardianQuest 中登记 Quest 1 完成状态。
- `reportHash` 为零值：合约没有为该地址记录 Quest 1 审计报告哈希。
- `badgeBalance=0`：该地址没有 Quest 1 勋章余额。
- 以上链上结果不会改变浏览器中的本地 `ACT6_COMPLETE`、EXP、水属性熟练度或本地徽记。
- `completed=true` 尚未获得可信、可公开地址的真实 RPC 验证；该分支目前只经过本地受控 Mock 验证。

本记录不得用于声称 `completed=true` 已经完成真实公共地址验收。

## 已真实验证项目

1. Monad Testnet RPC 可访问。
2. `eth_chainId` 返回 `0x279f`。
3. Chain ID 可正确解码为 `10143`。
4. `eth_blockNumber` 可正常读取。
5. 项目 Route Handler 返回 HTTP `200`。
6. `completed(uint256,address)` 可读取并解码。
7. `reportHashes(uint256,address)` 可读取并解码。
8. `balanceOf(address,uint256)` 可读取并解码。
9. 三个 `eth_call` 使用同一个区块 tag。
10. API 正确返回网络、合约、查询地址、Quest ID、查询结果和区块高度。
11. 查询过程没有连接钱包。
12. 查询过程没有请求签名。
13. 查询过程没有发送链上写交易。
14. `.env.local` 被 Git 忽略，没有提交 RPC URL。

## 仅通过 Mock 验证项目

以下项目来自本地受控 Mock 或本地输入校验，不代表 Monad Testnet 曾发生对应故障：

- `completed=true` 的 API 与 UI 分支。
- `completed=false` 的受控响应分支。
- RPC 超时。
- Chain ID 不匹配。
- 合约调用失败。
- 未配置服务端环境变量。
- 非法 EVM 地址。
- 超长地址。

真实 RPC 已额外验证 `completed=false`。其他错误分支仍应保持为受控测试结论。

## ABI 与 Selector 来源

实际使用的只读方法：

| 方法 | 返回类型 | Selector |
|---|---|---|
| `completed(uint256,address)` | `bool` | `ffc4ed25` |
| `reportHashes(uint256,address)` | `bytes32` | `67ac1437` |
| `balanceOf(address,uint256)` | `uint256` | `00fdd58e` |

Selector 来源：

```text
out/GuardianQuest.sol/GuardianQuest.json
methodIdentifiers
```

这些 selector 来自当前仓库编译产物，不是凭记忆手写或猜测所得。

## 安全边界

- 查询仅允许 `eth_chainId`、`eth_blockNumber` 和 `eth_call`。
- API 不接受用户提供的 RPC URL、合约地址、JSON-RPC method 或 calldata。
- 查询设置约 10 秒超时，不自动循环重试。
- 查询结果使用 `no-store`，构建阶段不访问 RPC。
- 查询不会连接钱包、请求签名或发送交易。
- 本地通关状态与链上 `completed` 相互独立。
- 本地徽记展示不等同于链上 Quest 1 勋章余额。
- 文档没有记录真实 RPC URL、RPC 凭据、私钥、请求 Header 或非公开用户地址。

## 环境变量与隐私

本地只读查询需要以下服务端环境变量：

```text
MONAD_RPC_URL
GUARDIAN_QUEST_ADDRESS
MONAD_CHAIN_ID
```

占位配置见 [`web/.env.example`](../web/.env.example)。

- `MONAD_RPC_URL` 只在 Route Handler 使用的服务端 helper 中读取。
- 项目不使用 `NEXT_PUBLIC_MONAD_RPC_URL`，RPC URL 不进入浏览器 bundle。
- `.env.local` 不进入 Git。
- 没有环境变量时，`npm run build` 仍可成功。
- 未配置时 API 返回 `CHAIN_NOT_CONFIGURED`。
- 未配置或 RPC 失败不会影响本地学习结果。

## 复现步骤

以下步骤不会在命令行打印 RPC URL：

1. 从仓库根目录进入前端：

   ```powershell
   Set-Location web
   ```

2. 从占位示例创建本地配置：

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. 在本机编辑 `.env.local`，配置服务端 RPC、已核验 GuardianQuest 地址和 Chain ID。不要提交该文件。

4. 启动开发服务器：

   ```powershell
   npm run dev
   ```

5. 使用终端实际显示的端口请求公共测试地址。例如端口为 `<PORT>` 时：

   ```powershell
   Invoke-RestMethod "http://127.0.0.1:<PORT>/api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD"
   ```

6. 核对返回的网络、合约、Quest ID、`completed`、`reportHash`、`badgeBalance` 和 `blockNumber`。

7. 使用 `Ctrl+C` 停止开发服务器。

8. 从仓库根目录确认 `.env.local` 被忽略：

   ```powershell
   git check-ignore -v web/.env.local
   git status --short
   ```

## 当前限制

- 尚无可信、可公开的已登记地址用于真实验证 `completed=true`。
- 本记录没有验证链上写入、勋章铸造或钱包交互；这些能力不属于前端只读查询范围。
- GuardianQuest 没有提供完成时间的 view 方法，因此 API 和文档不记录完成时间。
- 本次真实查询只代表区块 `48528289` 上公共测试地址的状态。
