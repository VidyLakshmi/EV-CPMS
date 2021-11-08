import AsyncTask, { AsyncTaskStatus, AsyncTasks } from '../types/AsyncTask';
import global, { ActionsResponse, DatabaseDocumentChange } from '../types/GlobalType';

import AbstractAsyncTask from './AsyncTask';
import AsyncTaskConfiguration from '../types/configuration/AsyncTaskConfiguration';
import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import BillTransactionAsyncTask from './tasks/BillTransactionAsyncTask';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import OCPICheckCdrsAsyncTask from './tasks/ocpi/OCPICheckCdrsAsyncTask';
import OCPICheckLocationsAsyncTask from './tasks/ocpi/OCPICheckLocationsAsyncTask';
import OCPICheckSessionsAsyncTask from './tasks/ocpi/OCPICheckSessionsAsyncTask';
import OCPIPullCdrsAsyncTask from './tasks/ocpi/OCPIPullCdrsAsyncTask';
import OCPIPullLocationsAsyncTask from './tasks/ocpi/OCPIPullLocationsAsyncTask';
import OCPIPullSessionsAsyncTask from './tasks/ocpi/OCPIPullSessionsAsyncTask';
import OCPIPullTokensAsyncTask from './tasks/ocpi/OCPIPullTokensAsyncTask';
import OCPIPushEVSEStatusesAsyncTask from './tasks/ocpi/OCPIPushEVSEStatusesAsyncTask';
import OCPIPushTokensAsyncTask from './tasks/ocpi/OCPIPushTokensAsyncTask';
import { Promise } from 'bluebird';
import { ServerAction } from '../types/Server';
import SynchronizeCarCatalogsAsyncTask from './tasks/SynchronizeCarCatalogsAsyncTask';
import TagsImportAsyncTask from './tasks/TagsImportAsyncTask';
import UsersImportAsyncTask from './tasks/UsersImportAsyncTask';
import Utils from '../utils/Utils';

const MODULE_NAME = 'AsyncTaskManager';

export default class AsyncTaskManager {
  private static asyncTaskConfig: AsyncTaskConfiguration;

  public static async init(): Promise<void> {
    // Get the conf
    AsyncTaskManager.asyncTaskConfig = Configuration.getAsyncTaskConfig();
    if (AsyncTaskManager.asyncTaskConfig?.active) {
      // Turn all Running task to Pending
      await AsyncTaskStorage.updateRunningAsyncTaskToPending();
      // Run it
      void AsyncTaskManager.handleAsyncTasks();
      // Listen to DB events
      await global.database.watchDatabaseCollection(Constants.DEFAULT_TENANT_OBJECT, 'asynctasks',
        (documentID: unknown, documentChange: DatabaseDocumentChange, document: unknown) => {
          if (documentChange === DatabaseDocumentChange.UPDATE ||
              documentChange === DatabaseDocumentChange.INSERT) {
            // Check status
            if (document['status'] === AsyncTaskStatus.PENDING) {
              // Trigger the Async Framework
              void AsyncTaskManager.handleAsyncTasks();
            }
          }
        }
      );
    }
  }

  public static async handleAsyncTasks(): Promise<void> {
    // Active?
    if (AsyncTaskManager.asyncTaskConfig?.active) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'handleAsyncTasks',
        message: 'Checking asynchronous task to process...'
      });
      const processedTask: ActionsResponse = {
        inError: 0,
        inSuccess: 0,
      };
      const startTime = new Date().getTime();
      // Handle number of instances
      let nbrTasksInParallel = 1;
      if (this.asyncTaskConfig.nbrTasksInParallel > 0) {
        nbrTasksInParallel = this.asyncTaskConfig.nbrTasksInParallel;
      }
      // Get the tasks
      const asyncTasks = await AsyncTaskStorage.getAsyncTasks(
        { status: AsyncTaskStatus.PENDING }, Constants.DB_PARAMS_MAX_LIMIT);
      // Process them
      if (!Utils.isEmptyArray(asyncTasks.result)) {
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: `${asyncTasks.result.length} asynchronous task(s) are going to be processed...`
        });
        await Promise.map(asyncTasks.result,
          async (asyncTask: AsyncTask) => {
            // Tasks
            const abstractAsyncTask = await AsyncTaskManager.createTask(asyncTask);
            if (abstractAsyncTask) {
              // Get the lock
              const asyncTaskLock = await LockingHelper.acquireAsyncTaskLock(Constants.DEFAULT_TENANT, asyncTask.id);
              if (asyncTaskLock) {
                const startAsyncTaskTime = new Date().getTime();
                try {
                  // Update the task
                  asyncTask.execTimestamp = new Date();
                  asyncTask.execHost = Utils.getHostName();
                  asyncTask.status = AsyncTaskStatus.RUNNING;
                  asyncTask.lastChangedOn = asyncTask.execTimestamp;
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Log
                  await Logging.logInfo({
                    tenantID: Constants.DEFAULT_TENANT,
                    action: ServerAction.ASYNC_TASK,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    message: `The asynchronous task '${asyncTask.name}' is running...`
                  });
                  // Run
                  await abstractAsyncTask.run();
                  // Duration
                  const asyncTaskTotalDurationSecs = Utils.truncTo((new Date().getTime() - startAsyncTaskTime) / 1000, 2);
                  // Mark the task
                  asyncTask.status = AsyncTaskStatus.SUCCESS;
                  asyncTask.execDurationSecs = asyncTaskTotalDurationSecs;
                  asyncTask.lastChangedOn = new Date();
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  processedTask.inSuccess++;
                  // Log
                  await Logging.logInfo({
                    tenantID: Constants.DEFAULT_TENANT,
                    action: ServerAction.ASYNC_TASK,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    message: `The asynchronous task '${asyncTask.name}' has been processed in ${asyncTaskTotalDurationSecs} secs`
                  });
                } catch (error) {
                  processedTask.inError++;
                  // Update the task
                  asyncTask.status = AsyncTaskStatus.ERROR;
                  asyncTask.message = error.message;
                  asyncTask.execDurationSecs = Utils.truncTo((new Date().getTime() - startAsyncTaskTime) / 1000, 2);
                  asyncTask.lastChangedOn = new Date();
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Log error
                  await Logging.logError({
                    tenantID: Constants.DEFAULT_TENANT,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    action: ServerAction.ASYNC_TASK,
                    message: `Error while running the asynchronous task '${asyncTask.name}': ${error.message as string}`,
                    detailedMessages: { error: error.stack, asyncTask }
                  });
                } finally {
                  // Release lock
                  await LockingManager.release(asyncTaskLock);
                }
              }
            }
          },
          { concurrency: nbrTasksInParallel });
        // Log result
        const totalDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.ASYNC_TASK,
          MODULE_NAME, 'handleAsyncTasks', processedTask,
          `{{inSuccess}} asynchronous task(s) were successfully processed in ${totalDurationSecs} secs`,
          `{{inError}} asynchronous task(s) failed to be processed in ${totalDurationSecs} secs`,
          `{{inSuccess}} asynchronous task(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed`,
          'No asynchronous task to process'
        );
      } else {
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: 'No asynchronous task to process'
        });
      }
    }
  }

  private static async createTask(asyncTask: AsyncTask): Promise<AbstractAsyncTask> {
    switch (asyncTask.name) {
      case AsyncTasks.BILL_TRANSACTION:
        return new BillTransactionAsyncTask(asyncTask);
      case AsyncTasks.TAGS_IMPORT:
        return new TagsImportAsyncTask(asyncTask);
      case AsyncTasks.USERS_IMPORT:
        return new UsersImportAsyncTask(asyncTask);
      case AsyncTasks.SYNCHRONIZE_CAR_CATALOGS:
        return new SynchronizeCarCatalogsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PUSH_TOKENS:
        return new OCPIPushTokensAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PULL_LOCATIONS:
        return new OCPIPullLocationsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PULL_SESSIONS:
        return new OCPIPullSessionsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PULL_CDRS:
        return new OCPIPullCdrsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_CHECK_CDRS:
        return new OCPICheckCdrsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_CHECK_SESSIONS:
        return new OCPICheckSessionsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_CHECK_LOCATIONS:
        return new OCPICheckLocationsAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PULL_TOKENS:
        return new OCPIPullTokensAsyncTask(asyncTask);
      case AsyncTasks.OCPI_PUSH_EVSE_STATUSES:
        return new OCPIPushEVSEStatusesAsyncTask(asyncTask);
      default:
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: `The asynchronous task '${asyncTask.name as string}' is unknown`
        });
    }
  }
}
