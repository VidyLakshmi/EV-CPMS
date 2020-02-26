import { Car, CarSynchronizeAction } from '../../types/Car';
import BackendError from '../../exception/BackendError';
import CarDatabaseFactory from './CarDatabaseFactory';
import Constants from '../../utils/Constants';
import { Action } from '../../types/Authorization';
import CarStorage from '../../storage/mongodb/CarStorage';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';

export default abstract class CarDatabase {
  public abstract async getCars(): Promise<Car[]>;
  
  public async synchronizeCars(): Promise<CarSynchronizeAction> {
    /* eslint-disable */
    const actionsDone = {
      synchronized: 0,
      error: 0
    } as CarSynchronizeAction;
    const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
    if (!carDatabaseImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Cars is not configured or implementation is missing',
        module: 'CarDatabase', method: 'synchronizeCars',
        action: Action.SYNCHRONIZE_CARS,
      });
    }
    // Get the cars
    const cars = await carDatabaseImpl.getCars();
    for (const car of cars) {
      try {
        const carDB = await CarStorage.getCar(car.id);
        if (!carDB) {
          // New Car: Create it
          car.hash = Cypher.hash(JSON.stringify(car));
          car.createdOn = new Date();
          await CarStorage.saveCar(car);
          actionsDone.synchronized++;
        } else if (Cypher.hash(JSON.stringify(car)) !== carDB.hash) {
          // Car has changed: Update it
          car.hash = Cypher.hash(JSON.stringify(car));
          car.lastChangedOn = new Date();
          await CarStorage.saveCar(car);
          actionsDone.synchronized++;
        }
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: 'CarDatabase', method: 'synchronizeCars',
          message: `${car.vehicleMake} - ${car.VehicleModel} has been synchronized successfully`,
        });
      } catch (error) {
        actionsDone.error++;
        // Log
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: Constants.CENTRAL_SERVER,
          action: Action.SYNCHRONIZE_CARS,
          module: 'CarDatabase', method: 'synchronizeCars',
          message: `${car.vehicleMake} - ${car.VehicleModel} got synchronization error`,
          detailedMessages: error
        });
      }
    }
    return actionsDone;
  }
}
