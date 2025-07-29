const EventSource = require("eventsource");
const http = require("http");

const baseUrlTest = "http://localhost:5000";

class StreamingServiceStressTest {
  constructor(baseUrl = baseUrlTest) {
    this.baseUrl = baseUrl;
    this.gameIds = ["2001", "2002", "2003"];
    this.connections = [];
    this.stats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      errors: [],
    };
  }

  async createConnection(gameId, connectionId) {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.baseUrl}/live/${gameId}`;
        const eventSource = new EventSource(url);

        const connection = {
          id: connectionId,
          gameId,
          eventSource,
          startTime: Date.now(),
          messageCount: 0,
          status: "connecting",
        };

        eventSource.onopen = () => {
          connection.status = "connected";
          this.stats.successfulConnections++;
          this.stats.activeConnections++;
          console.log(`✅ Connection ${connectionId} (Game: ${gameId}) established`);
          resolve(connection);
        };

        eventSource.onmessage = (event) => {
          connection.messageCount++;
          this.stats.messagesReceived++;

          if (connection.messageCount <= 3) {
            console.log(
              `📨 Connection ${connectionId} received message ${connection.messageCount}: ${event.data.substring(0, 100)}...`
            );
          }
        };

        eventSource.onerror = (error) => {
          connection.status = "error";
          this.stats.failedConnections++;
          this.stats.activeConnections--;
          this.stats.errors.push({
            connectionId,
            gameId,
            error: error.message || "Unknown error",
            timestamp: new Date().toISOString(),
          });
          console.log(`❌ Connection ${connectionId} (Game: ${gameId}) failed: ${error.message || "Unknown error"}`);
          reject(error);
        };

        eventSource.onclose = () => {
          connection.status = "closed";
          this.stats.activeConnections--;
          console.log(`🔌 Connection ${connectionId} (Game: ${gameId}) closed`);
        };

        this.connections.push(connection);
        this.stats.totalConnections++;
      } catch (error) {
        this.stats.failedConnections++;
        this.stats.errors.push({
          connectionId,
          gameId,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      }
    });
  }

  async createConnectionsBatch(batchSize, delayMs = 100) {
    console.log(`🚀 Creating batch of ${batchSize} connections...`);

    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const connectionId = this.stats.totalConnections + i + 1;
      // const gameId = this.gameIds[connectionId % this.gameIds.length];

      promises.push(
        this.createConnection("2001", connectionId).catch((error) => {
          // Error already logged in createConnection
          return null;
        })
      );

      // Add small delay between connections to avoid overwhelming the server
      if (delayMs > 0 && i < batchSize - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    await Promise.all(promises);
    console.log(`✅ Batch completed. Active connections: ${this.stats.activeConnections}`);
  }

  async runStressTest(totalConnections = 100, batchSize = 10, delayBetweenBatches = 1000) {
    console.log(`🎯 Starting stress test: ${totalConnections} total connections`);
    console.log(`📊 Batch size: ${batchSize}, Delay between batches: ${delayBetweenBatches}ms`);
    console.log(`🎮 Games: ${this.gameIds.join(", ")}`);
    console.log("=".repeat(60));

    const startTime = Date.now();
    const totalBatches = Math.ceil(totalConnections / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const remainingConnections = totalConnections - this.stats.totalConnections;
      const currentBatchSize = Math.min(batchSize, remainingConnections);

      console.log(`\n📦 Batch ${batch + 1}/${totalBatches} (${currentBatchSize} connections)`);

      await this.createConnectionsBatch(currentBatchSize, 50);

      // Print current stats
      this.printStats();

      if (batch < totalBatches - 1) {
        console.log(`⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log("\n" + "=".repeat(60));
    console.log("🎉 STRESS TEST COMPLETED");
    console.log("=".repeat(60));
    this.printFinalStats(duration);
  }

  printStats() {
    console.log(`📈 Current Stats:`);
    console.log(`   Total: ${this.stats.totalConnections}`);
    console.log(`   Active: ${this.stats.activeConnections}`);
    console.log(`   Successful: ${this.stats.successfulConnections}`);
    console.log(`   Failed: ${this.stats.failedConnections}`);
    console.log(`   Messages: ${this.stats.messagesReceived}`);
  }

  printFinalStats(duration) {
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Final Results:`);
    console.log(`   Total Connections Attempted: ${this.stats.totalConnections}`);
    console.log(`   Successful Connections: ${this.stats.successfulConnections}`);
    console.log(`   Failed Connections: ${this.stats.failedConnections}`);
    console.log(
      `   Success Rate: ${((this.stats.successfulConnections / this.stats.totalConnections) * 100).toFixed(2)}%`
    );
    console.log(`   Active Connections: ${this.stats.activeConnections}`);
    console.log(`   Total Messages Received: ${this.stats.messagesReceived}`);
    console.log(
      `   Average Messages per Connection: ${(this.stats.messagesReceived / this.stats.successfulConnections).toFixed(2)}`
    );

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (first 10):`);
      this.stats.errors.slice(0, 10).forEach((error) => {
        console.log(`   Connection ${error.connectionId} (${error.gameId}): ${error.error}`);
      });
    }
  }

  async closeAllConnections() {
    console.log(`🔌 Closing all ${this.connections.length} connections...`);

    this.connections.forEach((connection) => {
      if (connection.eventSource && connection.status === "connected") {
        connection.eventSource.close();
      }
    });

    this.connections = [];
    this.stats.activeConnections = 0;
    console.log("✅ All connections closed");
  }

  async monitorConnections(duration = 30000) {
    console.log(`👀 Monitoring connections for ${duration / 1000} seconds...`);

    const interval = setInterval(() => {
      this.printStats();
    }, 5000);

    await new Promise((resolve) => setTimeout(resolve, duration));
    clearInterval(interval);
  }
}

// CLI Usage
async function main() {
  const args = process.argv.slice(2);
  const totalConnections = parseInt(args[0]) || 100;
  const batchSize = parseInt(args[1]) || 10;
  const delayBetweenBatches = parseInt(args[2]) || 1000;
  const baseUrl = args[3] || baseUrlTest;

  const stressTest = new StreamingServiceStressTest(baseUrl);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...");
    await stressTest.closeAllConnections();
    process.exit(0);
  });

  try {
    await stressTest.runStressTest(totalConnections, batchSize, delayBetweenBatches);

    // Keep connections alive for monitoring
    console.log("\n👀 Keeping connections alive for monitoring. Press Ctrl+C to exit.");
    await stressTest.monitorConnections(60000); // Monitor for 1 minute
  } catch (error) {
    console.error("💥 Stress test failed:", error);
    await stressTest.closeAllConnections();
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = StreamingServiceStressTest;
