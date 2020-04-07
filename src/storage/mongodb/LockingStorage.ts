import cfenv from 'cfenv';
import os from 'os';
import global from '../../types/GlobalType';
import Lock from '../../types/Lock';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class LockingStorage {
  public static async getLocks(): Promise<Lock[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'getLocks');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Read DB
    const locksMDB = await global.database.getCollection<Lock>(Constants.DEFAULT_TENANT, 'locks')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('LockingStorage', 'getLocks', uniqueTimerID);
    // Ok
    return locksMDB;
  }

  public static async getLockStatus(lockToTest: Lock, lockOnMultipleHosts = true): Promise<boolean> {
    //  Check
    const locks = await LockingStorage.getLocks();
    const lockFound: Lock = locks.find((lock: Lock): boolean => {
      if (lockOnMultipleHosts) {
        // Same name and type
        return ((lockToTest.name === lock.name) &&
          (lockToTest.type === lock.type));
      }
      // Same name, hostname and type
      return ((lockToTest.name === lock.name) &&
          (lockToTest.type === lock.type)) &&
          (lockToTest.hostname === lock.hostname);

    });
    if (lockFound) {
      return true;
    }
    return false;
  }

  public static async cleanLocks(hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'cleanLocks');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .deleteMany({ hostname: hostname });
    // Debug
    Logging.traceEnd('LockingStorage', 'cleanLocks', uniqueTimerID);
  }

  public static async saveRunLock(runLockToSave: Lock): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'saveRunLock');
    // Transfer
    const runLockMDB = {
      _id: runLockToSave.id,
      name: runLockToSave.name,
      type: runLockToSave.type,
      timestamp: Utils.convertToDate(runLockToSave.timestamp),
      hostname: runLockToSave.hostname
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(runLockMDB);
    // Debug
    Logging.traceEnd('LockingStorage', 'saveRunningMigration', uniqueTimerID, { runLock: runLockToSave });
  }

  public static async deleteRunLock(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('LockingStorage', 'deleteRunLock');
    // Delete
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .findOneAndDelete({ '_id': id });
    // Debug
    Logging.traceEnd('LockingStorage', 'deleteRunLock', uniqueTimerID, { id });
  }
}
