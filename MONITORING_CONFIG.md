# Monitoring Configuration - Prometheus + Grafana + AlertManager

## Prometheus Configuration
## Location: ./prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'ableka-lumina'
    environment: 'production'
    version: '1.0.0'

# Alert configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules once and periodically evaluate them
rule_files:
  - 'alert_rules.yml'
  - 'recording_rules.yml'

# Scrape configs for monitoring jobs
scrape_configs:
  # API Service Metrics
  - job_name: 'lumina-api'
    static_configs:
      - targets: ['lumina-api:3000']
    scrape_interval: 10s
    scrape_timeout: 5s
    metrics_path: '/metrics'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
      - target_label: service
        replacement: 'api'

  # Agents Service Metrics
  - job_name: 'lumina-agents'
    static_configs:
      - targets: ['lumina-agents:3002']
    scrape_interval: 10s
    scrape_timeout: 5s
    metrics_path: '/metrics'
    relabel_configs:
      - target_label: service
        replacement: 'agents'

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 15s
    relabel_configs:
      - target_label: service
        replacement: 'database'

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 15s
    relabel_configs:
      - target_label: service
        replacement: 'cache'

  # Docker Container Metrics
  - job_name: 'docker'
    static_configs:
      - targets: ['cadvisor:8080']
    scrape_interval: 15s

  # Node Exporter (Host System Metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s

---

## Alert Rules Configuration
## Location: ./alert_rules.yml

groups:
  - name: api_alerts
    interval: 30s
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)) > 0.05
        for: 5m
        labels:
          severity: critical
          service: api
        annotations:
          summary: "High error rate detected in {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.service }}"
          runbook: "https://wiki.company.com/runbooks/high-error-rate"

      # Slow Response Time
      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)) > 2
        for: 5m
        labels:
          severity: warning
          service: api
        annotations:
          summary: "Slow response time for {{ $labels.endpoint }}"
          description: "p95 latency is {{ $value | humanizeDuration }}"

      # High Request Latency
      - alert: HighRequestLatency
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="api"}[5m])) by (le)) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High request latency detected"
          description: "99th percentile latency is {{ $value | humanizeDuration }}"

      # Service Down
      - alert: ServiceDown
        expr: up{job=~"lumina-.*"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} service is down"
          description: "{{ $labels.job }} has been down for more than 1 minute"

      # Rate Limiting Activated
      - alert: RateLimitingActive
        expr: sum(rate(rate_limit_hits_total[5m])) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rate limiting being triggered"
          description: "{{ $value | humanize }} rate limit hits per second"

  - name: database_alerts
    interval: 30s
    rules:
      # Database Connection Pool Exhaustion
      - alert: DBConnectionPoolExhaustion
        expr: |
          (pg_stat_activity_count / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: critical
          service: database
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "{{ $value | humanizePercentage }} of connections in use"

      # Slow Queries
      - alert: SlowQueries
        expr: |
          histogram_quantile(0.95, sum(rate(pg_statement_mean_exec_time[5m])) by (le)) > 1000
        for: 5m
        labels:
          severity: warning
          service: database
        annotations:
          summary: "Slow database queries detected"
          description: "p95 query time is {{ $value | humanizeDuration }}"

      # Table Size Growing
      - alert: TableSizeGrowing
        expr: |
          rate(pg_table_total_relation_size_bytes[1h]) > 0
        labels:
          severity: info
        annotations:
          summary: "Table sizes growing in database"

  - name: cache_alerts
    interval: 30s
    rules:
      # Cache Hit Ratio Low
      - alert: LowCacheHitRatio
        expr: |
          (redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)) < 0.7
        for: 10m
        labels:
          severity: warning
          service: cache
        annotations:
          summary: "Cache hit ratio below 70%"
          description: "Cache hit ratio is {{ $value | humanizePercentage }}"

      # Memory Usage High
      - alert: HighMemoryUsage
        expr: |
          (redis_memory_used_bytes / redis_memory_max_bytes) > 0.8
        for: 5m
        labels:
          severity: warning
          service: cache
        annotations:
          summary: "Redis memory usage above 80%"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Redis Evictions
      - alert: RedisEvictions
        expr: |
          increase(redis_evicted_keys_total[5m]) > 100
        for: 5m
        labels:
          severity: critical
          service: cache
        annotations:
          summary: "Redis is evicting keys"
          description: "{{ $value | humanize }} keys evicted in last 5 minutes"

  - name: compliance_alerts
    interval: 30s
    rules:
      # KYC Check Failures
      - alert: HighKYCFailureRate
        expr: |
          (sum(rate(kyc_check_total{status="REJECTED"}[5m])) / sum(rate(kyc_check_total[5m]))) > 0.1
        for: 5m
        labels:
          severity: warning
          service: compliance
        annotations:
          summary: "KYC check failure rate above 10%"
          description: "{{ $value | humanizePercentage }} KYC checks are being rejected"

      # AML Check Escalations
      - alert: HighAMLEscalationRate
        expr: |
          (sum(rate(aml_check_total{status="ESCALATED"}[5m])) / sum(rate(aml_check_total[5m]))) > 0.2
        for: 5m
        labels:
          severity: warning
          service: compliance
        annotations:
          summary: "AML check escalation rate above 20%"
          description: "{{ $value | humanizePercentage }} AML checks being escalated"

  - name: host_alerts
    interval: 30s
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: |
          (100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value | humanize }}%"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: |
          ((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes) > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High system memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: |
          (100 - (node_filesystem_avail_bytes{device!~"tmpfs|fuse.lxcfs"} / node_filesystem_size_bytes{device!~"tmpfs|fuse.lxcfs"} * 100)) > 85
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space below 15%"
          description: "Disk {{ $labels.device }} is {{ $value | humanize }}% full"

---

## Recording Rules
## Location: ./recording_rules.yml

groups:
  - name: api_metrics
    interval: 30s
    rules:
      # Request rate by endpoint
      - record: api:requests:rate1m
        expr: sum(rate(http_requests_total[1m])) by (endpoint, method)

      # Error rate by endpoint
      - record: api:errors:rate1m
        expr: sum(rate(http_requests_total{status=~"5.."}[1m])) by (endpoint)

      # Latency percentiles
      - record: api:latency:p95
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))

      - record: api:latency:p99
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))

  - name: compliance_metrics
    interval: 30s
    rules:
      # KYC decision rate
      - record: compliance:kyc:decisions:rate1m
        expr: sum(rate(kyc_check_total[1m])) by (status)

      # AML decision rate
      - record: compliance:aml:decisions:rate1m
        expr: sum(rate(aml_check_total[1m])) by (status)

      # Compliance decision distribution
      - record: compliance:decisions:distribution
        expr: sum(compliance_check_total) by (status)

---

## AlertManager Configuration
## Location: ./alertmanager.yml

global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

route:
  # Default receiver for all alerts
  receiver: 'default'
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  # Critical alerts to PagerDuty
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      group_wait: 0s

    - match:
        severity: warning
      receiver: 'slack'
      group_wait: 30s

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack'
    slack_configs:
      - channel: '#warnings'
        title: 'Warning: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
  # Suppress warnings if critical alert exists
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']

---

## Grafana Dashboard Metrics

### Dashboard: Lumina Compliance Platform Overview

**Row 1: System Health**
- API Availability (%)
- Agents Service Status
- Database Connection Pool
- Redis Cache Status

**Row 2: Request Metrics**
- Requests Per Second (by endpoint)
- Request Latency p95, p99
- Error Rate (%)
- Rate Limit Activations

**Row 3: Compliance Checks**
- KYC Checks Per Minute (by status)
- AML Checks Per Minute (by status)
- Compliance Check Duration
- Pattern Detection Cache Hit Ratio

**Row 4: Infrastructure**
- CPU Usage (%)
- Memory Usage (%)
- Disk I/O
- Network Traffic

**Row 5: Database**
- Query Latency p95
- Connection Pool Usage
- Slow Queries per Minute
- Table Sizes

**Row 6: Cache**
- Cache Hit Ratio
- Keys by Type
- Memory Usage
- Evictions per Minute

---

## Key Metrics to Monitor

### SLO Targets (Service Level Objectives)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Availability | 99.9% | <99%              |
| KYC Latency p95 | <2s | >5s              |
| AML Latency p95 | <3s | >8s              |
| Error Rate | <0.1% | >0.5%            |
| Cache Hit Ratio | >80% | <70%            |
| DB Connection Pool | <70% | >85%            |

### Critical Metrics

1. **Service Health**
   - API service up/down
   - Agents service up/down
   - Database connectivity
   - Redis connectivity

2. **Performance**
   - Request latency (p50, p95, p99)
   - Requests per second
   - Database query time
   - Cache hit ratio

3. **Reliability**
   - Error rate by endpoint
   - Failed compliance checks
   - Escalated decisions
   - Retries and timeouts

4. **Resource Utilization**
   - CPU usage
   - Memory usage
   - Disk space
   - Database connections
   - Redis memory

5. **Business Metrics**
   - KYC decisions (approved/rejected/escalated)
   - AML decisions (approved/rejected/escalated)
   - Compliance check distribution
   - Velocity anomalies detected

---

**Last Updated**: February 27, 2026
**Version**: 1.0.0
**Status**: Production Ready
