import Connection from '../../types/Connection';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ConnectionStorage';

export default class ConnectionStorage {

  static async saveConnection(tenant: Tenant, connectionToSave: Connection): Promise<string> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create
    const connectionMDB: any = {
      _id: !connectionToSave.id ? new ObjectId() : DatabaseUtils.convertToObjectID(connectionToSave.id),
      connectorId: connectionToSave.connectorId,
      userId: DatabaseUtils.convertToObjectID(connectionToSave.userId),
      createdAt: Utils.convertToDate(connectionToSave.createdAt),
      updatedAt: Utils.convertToDate(connectionToSave.updatedAt),
      validUntil: Utils.convertToDate(connectionToSave.validUntil),
      data: connectionToSave.data
    };
    // Update
    const result = await global.database.getCollection<any>(tenant.id, 'connections').findOneAndUpdate(
      { _id: connectionMDB._id },
      { $set: connectionMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveConnection', uniqueTimerID, connectionMDB);
    return result.value._id.toString();
  }

  static async getConnectionByConnectorIdAndUserId(tenant: Tenant, connectorId: string, userId: string, projectFields?: string[]): Promise<Connection> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    aggregation.push({
      $match: { connectorId: connectorId, userId: DatabaseUtils.convertToObjectID(userId) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<Connection>(tenant.id, 'connections')
      .aggregate<Connection>(aggregation)
      .toArray();
    let connection: Connection;
    if (!Utils.isEmptyArray(connections)) {
      connection = connections[0];
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnectionByConnectorIdAndUserId', uniqueTimerID, connections);
    return connection;
  }

  static async getConnectionsByUserId(tenant: Tenant, userID: string, projectFields?: string[]): Promise<DataResult<Connection>> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    aggregation.push({
      $match: { userId: DatabaseUtils.convertToObjectID(userID) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Get connections
    const connectionsMDB = await global.database.getCollection<Connection>(tenant.id, 'connections')
      .aggregate<Connection>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray();
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnectionByUserId', uniqueTimerID, connectionsMDB);
    return {
      count: connectionsMDB.length,
      result: connectionsMDB
    };
  }

  static async getConnection(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<Connection> {
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: DatabaseUtils.convertToObjectID(id) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<Connection>(tenant.id, 'connections')
      .aggregate<Connection>(aggregation)
      .toArray();
    let connection: Connection;
    if (!Utils.isEmptyArray(connections)) {
      connection = connections[0];
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnection', uniqueTimerID, connections);
    return connection;
  }

  static async deleteConnectionById(tenant: Tenant, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    // Check
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<Connection>(tenant.id, 'connections')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteConnectionById', uniqueTimerID, { id });
  }

  static async deleteConnectionByUserId(tenant: Tenant, userID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceDatabaseRequestStart();
    // Check
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'connections')
      .deleteMany({ 'userId': DatabaseUtils.convertToObjectID(userID) });
    // Debug
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteConnectionByUserId', uniqueTimerID, { userID });
  }
}
