#!/bin/sh
# Vega Bulut günlük yedeği (Docker kurulumu). Tüm veritabanlarının tutarlı kopyası
# vega-veri biriminde /data/yedek/<zaman>/ altına alınır; son SAKLA (7) yedek tutulur.
# cron:  0 3 * * *  /opt/vega/deploy/yedekle.sh >> /var/log/vega-yedek.log 2>&1
set -eu
cd "$(dirname "$0")"
docker compose exec -T vega node --disable-warning=ExperimentalWarning src/cli.js yedek --sakla "${SAKLA:-7}"

# Sunucu dışına kopya ÖNERİLİR (disk arızası). Örnek (rclone yapılandırıldıysa):
# docker compose cp vega:/data/yedek ./yedek-kopya && rclone sync ./yedek-kopya uzak:vega-yedek
