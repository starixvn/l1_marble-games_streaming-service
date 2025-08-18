# Streaming Service Stress Test Tool

This tool allows you to simulate thousands of concurrent client connections to test your streaming service's performance and scalability.

## Features

- ✅ Simulate up to 50,000+ concurrent connections
- 📊 Real-time statistics and monitoring
- 🎮 Distributes connections across multiple games
- 📦 Batch processing to avoid overwhelming the server
- 🔄 Automatic retry and error handling
- 📈 Detailed performance metrics
- 🛑 Graceful shutdown handling

## Quick Start

### 1. Install Dependencies

```bash
# Copy the stress test files to a separate directory
mkdir stress-test
cd stress-test
cp ../stress-test.js .
cp ../stress-test-package.json package.json

# Install dependencies
npm install
```

### 2. Run Basic Tests

```bash
# Test with 100 connections (good for development)
npm run test:small

# Test with 1,000 connections (medium load)
npm run test:medium

# Test with 10,000 connections (high load)
npm run test:large

# Test with 50,000 connections (extreme load)
npm run test:extreme
```

### 3. Custom Test Parameters

```bash
# Syntax: node stress-test.js [totalConnections] [batchSize] [delayBetweenBatches] [baseUrl]
node stress-test.js 10000 100 1000 http://localhost:5000
```

## Parameters

| Parameter             | Default               | Description                             |
| --------------------- | --------------------- | --------------------------------------- |
| `totalConnections`    | 10000                 | Total number of connections to create   |
| `batchSize`           | 100                   | Number of connections created per batch |
| `delayBetweenBatches` | 1000                  | Delay in milliseconds between batches   |
| `baseUrl`             | http://localhost:5000 | Base URL of your streaming service      |

## Test Scenarios

### Development Testing (100-500 connections)

```bash
node stress-test.js 100 10 500
```

### Load Testing (1,000-5,000 connections)

```bash
node stress-test.js 5000 50 1000
```

### Stress Testing (10,000+ connections)

```bash
node stress-test.js 10000 100 1000
```

### Extreme Testing (50,000+ connections)

```bash
node stress-test.js 50000 200 2000
```

## Monitoring During Test

The tool provides real-time monitoring:

```
📈 Current Stats:
   Total: 1500
   Active: 1489
   Successful: 1489
   Failed: 11
   Messages: 4456
```

## Expected Output

```
🎯 Starting stress test: 10000 total connections
📊 Batch size: 100, Delay between batches: 1000ms
🎮 Games: 2001, 2002, 2003
============================================================

📦 Batch 1/100 (100 connections)
🚀 Creating batch of 100 connections...
✅ Connection 1 (Game: 2001) established
✅ Connection 2 (Game: 2002) established
...
✅ Batch completed. Active connections: 98

📈 Current Stats:
   Total: 100
   Active: 98
   Successful: 98
   Failed: 2
   Messages: 196

⏳ Waiting 1000ms before next batch...
```

## Performance Tips

### For Your Streaming Service

1. **Monitor Memory Usage**

   ```bash
   # Monitor Node.js memory usage
   node --max-old-space-size=4096 ./build/app.js
   ```

2. **Increase File Descriptor Limits** (Linux/Mac)

   ```bash
   # Check current limits
   ulimit -n

   # Increase limits (temporary)
   ulimit -n 65536
   ```

3. **Optimize Network Settings** (Linux)

   ```bash
   # Increase TCP backlog
   echo 65536 > /proc/sys/net/core/somaxconn

   # Increase file descriptor limits
   echo "* soft nofile 65536" >> /etc/security/limits.conf
   echo "* hard nofile 65536" >> /etc/security/limits.conf
   ```

### For Stress Testing

1. **Start Small**: Begin with 100-500 connections
2. **Gradual Increase**: Increase batch sizes gradually
3. **Monitor Resources**: Watch CPU, memory, and network usage
4. **Use Multiple Machines**: Distribute load across multiple test machines

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure your streaming service is running
   - Check if the port is correct
   - Verify firewall settings

2. **Too Many Open Files**
   - Increase file descriptor limits
   - Reduce batch size
   - Add more delay between batches

3. **Memory Issues**
   - Increase Node.js heap size
   - Monitor memory usage
   - Consider using multiple test instances

### Error Messages

```
❌ Connection 123 (Game: 2001) failed: connect ECONNREFUSED
```

- Service not running or wrong port

```
❌ Connection 456 (Game: 2002) failed: connect ETIMEDOUT
```

- Network issues or service overloaded

```
❌ Connection 789 (Game: 2003) failed: read ECONNRESET
```

- Connection dropped by server

## Integration with Monitoring

Use the monitoring endpoints to verify client counts:

```bash
# Check total clients
curl http://localhost:5000/api/monitor

# Check specific game
curl http://localhost:5000/api/monitor/2001
```

## Advanced Usage

### Programmatic Usage

```javascript
const StreamingServiceStressTest = require("./stress-test");

async function customTest() {
  const stressTest = new StreamingServiceStressTest("http://localhost:5000");

  // Create 1000 connections
  await stressTest.runStressTest(1000, 50, 500);

  // Monitor for 30 seconds
  await stressTest.monitorConnections(30000);

  // Close all connections
  await stressTest.closeAllConnections();
}

customTest();
```

### Multiple Test Instances

```bash
# Run multiple stress tests simultaneously
node stress-test.js 5000 50 1000 &
node stress-test.js 5000 50 1000 &
node stress-test.js 5000 50 1000 &
```

## Safety Notes

⚠️ **Important**:

- Always test on a development/staging environment first
- Monitor your server resources during testing
- Be prepared to restart your service if needed
- Consider the impact on your database and external services

## Performance Benchmarks

Typical performance expectations:

| Connections | Memory Usage | CPU Usage | Network |
| ----------- | ------------ | --------- | ------- |
| 1,000       | ~50MB        | ~5%       | ~1MB/s  |
| 5,000       | ~200MB       | ~15%      | ~5MB/s  |
| 10,000      | ~400MB       | ~25%      | ~10MB/s |
| 50,000      | ~2GB         | ~60%      | ~50MB/s |

_Results may vary based on hardware and configuration_
