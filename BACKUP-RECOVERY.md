# 数据备份、更新与回档

## 必须区分的两种操作

- **代码回退**：只切换前后端版本，继续使用当前数据库和上传目录。用于撤销界面或功能更新，正常情况下不丢更新后新增的数据。
- **历史数据恢复**：数据库损坏、误删或服务器故障时，从指定时间点的完整备份恢复。备份之后新增的数据不在该快照内，必须先保留当前状态、评估补录或合并，不能承诺无损覆盖。

Git 只管理源码，不能代替数据库、上传文件和配置备份。严禁通过 Git 覆盖生产数据目录；严禁将密钥、备份或数据库提交 Git。

## 当前备份方案

- 持久数据：`/var/lib/rd-studio`，与 `/opt/rd-studio/releases`、前端发布目录相互独立。
- 完整快照：`/var/backups/rd-studio/full/<UTC时间-进程号>`。
- 加密导出：`/var/backups/rd-studio/encrypted/<同名>.tar.enc`，AES-256-GCM，可检测篡改和错误密钥。
- 解密密钥：服务器 `/root/.rd-studio-backup.key`；本机独立目录 `E:\Coding\keys\rd-studio-backup\backup-aes256.key`。不要删除、改写、发到聊天或与公开文件一起分享。
- 本机副本：`E:\Coding\backups\rd-studio`，仅当前用户、SYSTEM 和本机管理员有权限。
- 每天 **北京时间 04:00** 完整备份；错过的计划由 systemd 补执行。新部署入口在更新前也自动完整备份，并使用同一维护锁防止备份与部署交叉执行。
- 快照包括当前前后端程序、Node 运行时、数据库、所有上传文件、环境配置、服务配置、Nginx 配置和 TLS 证书。数据复制期间短暂停止写入，复制完成立即启动服务，随后压缩、校验和加密。
- 校验内容：归档 SHA-256、数据库 integrity/foreign-key 检查、全部业务表记录数、数据文件逐字节哈希、上传文件存在性与大小，以及隔离恢复后应用启动和公共 API 检查。
- 只有 `VERIFIED` 文件存在、`restore-drill.log` 显示成功，才将此快照认定为已演练成功。加密导出失败仍会使备份服务报错。

本机不是服务器的实时镜像：本次已下载副本，以后的每日备份先保存在服务器，需要定期再次下载，或以后接入独立对象存储自动异地同步。

## 常用检查

```bash
systemctl list-timers rd-studio-backup.timer
systemctl show rd-studio-backup.service -p Result -p ExecMainStatus
journalctl -u rd-studio-backup.service -n 50 --no-pager
systemctl start rd-studio-backup.service
/opt/rd-studio/ops/verify-snapshot.sh /var/backups/rd-studio/full/<备份目录名>
```

备份不自动删除旧版本；空闲空间低于 2GiB 时停止新备份并报错，避免占满数据盘。需要定期查看空间和备份失败记录。当前没有配置短信或邮件告警。

## 后续更新规则

1. 阅读本文件，明确此次是否包含数据库迁移；先在副本上测试迁移及回退兼容性。
2. 运行测试和构建。禁止在生产数据上执行种子、重置、测试或批量清理脚本。
3. 前端使用 `scripts/deploy-youthful-frontend.sh`；后端使用 `scripts/deploy-note-upload.sh`，显式提供正确的 `RD_DB_VERSION`，不要依赖脚本旧默认值。
4. 两个入口均先调用已安装的完整备份工具；备份失败就停止部署。
5. 后端失败时只在数据库版本未变化的情况下自动回退代码；数据库版本已变化则停止服务保留最新数据，人工前向修复或使用审查过的兼容版本。**不再自动覆盖旧数据库快照。**
6. 上线后检查健康、关键页面、数据库完整性和实际新增记录；提交 Git 并写版本说明。

旧的 `deploy-mcp.sh`、`deploy-internal-access.sh` 已停用。`deploy/install.sh` 仅用于无数据库的新服务器，不得用于现有站点更新。

## 保留现有数据的代码回档

```bash
/opt/rd-studio/ops/rollback-code.sh \
  /opt/rd-studio/releases/<目标后端版本> \
  /www/wwwroot/rd-studio.club/releases/<配套前端版本>
```

工具先完整备份，再用**临时数据库副本**运行目标版本的数据库初始化并比较完整结构；不兼容会拒绝。切换失败会恢复原代码指向，整个过程不替换数据库和上传文件。

结构兼容不能证明所有旧代码业务语义都兼容。管理员仍需选择配套的前后端版本，且不能盲目回退到缺少新业务功能的版本。

## 灾难恢复

1. 先保存故障现场、最新数据文件、日志和密钥，暂停写入；不要先删除或覆盖现有数据。
2. 校验所选归档和 `VERIFIED`，在隔离目录解包并运行恢复演练。加密包先用密钥解密，校验失败不得使用。
3. 逐项确认文章、用户、经验、任务、知识库关系、草稿、消息及上传文件。确认所选备份时间之后是否仍有新增数据需要合并。
4. 保留故障数据原目录，恢复到新的目录并使用配套代码和配置；由运维明确确认后切换。不得只拷贝一个正在使用中的 SQLite 主文件，也不得忽略 WAL 或上传目录。
5. 恢复后复查权限、健康、登录、图片和关键业务，再重新开放写入并做新备份。

```powershell
node deploy/backup-crypto.mjs decrypt <备份.tar.enc> <新的输出.tar> E:\Coding\keys\rd-studio-backup\backup-aes256.key
node deploy/verify-encrypted-backup.mjs <备份.tar.enc> E:\Coding\keys\rd-studio-backup\backup-aes256.key
```

服务器整机故障时，每日快照的恢复点最多落后一个备份周期；服务器与本机同时损坏、密钥丢失或备份之后的写入，都不能靠旧快照实现零数据丢失。真正连续保护还需要独立异地存储及持续复制方案。
