const Configuration = require('../utils/Configuration');
const cron = require('node-cron');
const Logging = require('../utils/Logging');
const LoggingDatabaseTableCleanupTask = require('./tasks/LoggingDatabaseTableCleanupTask');

let _schedulerConfig = Configuration.getSchedulerConfig();

class SchedulerManager {
	static init() {
		// Active?
		if (_schedulerConfig.active) {
			// Log
			Logging.logInfo({
				module: "Scheduler",
				method: "init", action: "Initialization",
				message: `The Scheduler is active` });
			// Yes: init
			_schedulerConfig.tasks.forEach(task => {
				// Active?
				if (!task.active) {
					// Log
					Logging.logError({
						module: "Scheduler",
						method: "init", action: "Initialization",
						message: `The task '${task.name}' is inactive` });
					// No
					return;
				}
				// Tasks
				switch (task.name) {
					// Cleanup of logging table
					case "loggingDatabaseTableCleanup":
						let loggingDatabaseTableCleanupTask = new LoggingDatabaseTableCleanupTask();
						cron.schedule(task.periodicity, loggingDatabaseTableCleanupTask.run.bind(this, task.config));
						Logging.logInfo({
							module: "Scheduler",
							method: "init", action: "Initialization",
							message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
						break;

					// Unknown task
					default:
						// Log
						Logging.logError({
							module: "Scheduler",
							method: "init", action: "Initialization",
							message: `The task '${task.name}' is unknown` });
				}
			});
		} else {
			// Log
			Logging.logError({
				module: "Scheduler",
				method: "init", action: "Initialization",
				message: `The Scheduler is inactive` });
		}
	}
}

module.exports=SchedulerManager;
