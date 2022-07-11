/* eslint-disable max-len */
import { BillingAccount, BillingAccountStatus, BillingChargeInvoiceAction, BillingInvoiceStatus, BillingTransfer, BillingTransferStatus } from '../../src/types/Billing';
import { BillingPlatformFeeStrategyFactory, BillingTransferFactory } from '../factories/BillingFactory';
import chai, { expect } from 'chai';

import { BillingPeriodicOperationTaskConfig } from '../../src/types/TaskConfig';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import { BillingTestConfigHelper } from './StripeTestHelper';
import BillingTestHelper from './BillingTestHelper';
import CompanyFactory from '../factories/CompanyFactory';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SiteFactory from '../factories/SiteFactory';
import { StatusCodes } from 'http-status-codes';
import assert from 'assert';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const billingTestHelper = new BillingTestHelper();
// Conditional test execution function
const describeif = (condition) => condition ? describe : describe.skip;
const isBillingProperlyConfigured = BillingTestConfigHelper.isBillingProperlyConfigured();

describeif(isBillingProperlyConfigured)('Billing', () => {
  jest.setTimeout(60000);

  beforeAll(async () => {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
  });

  describe('Billing Platform (utbillingplatform)', () => {
    beforeAll(async () => {
      await billingTestHelper.initialize(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING_PLATFORM);
      // Initialize the Billing module
      await billingTestHelper.setBillingSystemValidCredentials();
    });

    describe('Where the admin user', () => {

      describe('Connected Accounts', () => {

        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        // Set the admin as the current user context
          billingTestHelper.setCurrentUserContextAsAdmin();
        });

        it('should create an account in an IDLE state and list it', async () => {
          const accountID = await billingTestHelper.createBillingAccount();
          // List accounts
          const response = await billingTestHelper.getCurrentUserService().billingApi.readBillingAccounts({
            userID: billingTestHelper.getCurrentUserContext().id,
            ID: accountID
          });
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.result.map((account: BillingAccount) => account.id)).to.include(accountID);
        });

        it('should not activate an inexistent account', async () => {
          const activationResponse = await billingTestHelper.getCurrentUserService().billingApi.activateBillingAccount({ accountID: '5ce249a1a39ae1c056c389bd', TenantID: billingTestHelper.getTenantID() });
          expect(activationResponse.status).to.be.eq(StatusCodes.NOT_FOUND);
        });

        it('should not activate a account twice', async () => {
        // Create a account
          const billingAccount = await billingTestHelper.getActivatedAccount();
          const activationResponse = await billingTestHelper.getCurrentUserService().billingApi.activateBillingAccount({ accountID: billingAccount.id, TenantID: billingTestHelper.getTenantID() });
          expect(activationResponse.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });

        it('should create a company assigned to a account', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          let companyResponse = await billingTestHelper.getCurrentUserService().companyApi.create({
            ...CompanyFactory.build(),
            accountData: {
              accountID: billingAccount.id,
              platformFeeStrategy
            }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          companyResponse = await billingTestHelper.getCurrentUserService().companyApi.readById(companyResponse.data.id);
          expect(companyResponse.data.accountData.accountID).to.eq(billingAccount.id);
          expect(companyResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        // Already tested
        xit('should update a company to assign a account', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          let companyResponse = await billingTestHelper.getCurrentUserService().companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          const companyID = companyResponse.data.id;
          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          companyResponse = await billingTestHelper.getCurrentUserService().companyApi.update({
            id: companyID,
            ...CompanyFactory.build(),
            accountData: {
              accountID: billingAccount.id,
              platformFeeStrategy
            }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          companyResponse = await billingTestHelper.getCurrentUserService().companyApi.readById(companyID);
          expect(companyResponse.data.accountData.accountID).to.eq(billingAccount.id);
          expect(companyResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should assign an account to a site', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          // Create a company
          const companyResponse = await billingTestHelper.getCurrentUserService().companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          // Create a site
          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          let siteResponse = await billingTestHelper.getCurrentUserService().siteApi.create({
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: {
              accountID: billingAccount.id,
              platformFeeStrategy
            }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);
          siteResponse = await billingTestHelper.getCurrentUserService().siteApi.readById(siteResponse.data.id);
          expect(siteResponse.data.accountData.accountID).to.eq(billingAccount.id);
          expect(siteResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should update a site to assign a account', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          // Create a company
          const companyResponse = await billingTestHelper.getCurrentUserService().companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          // Create a site
          let siteResponse = await billingTestHelper.getCurrentUserService().siteApi.create({
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);
          const siteID = siteResponse.data.id;

          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          siteResponse = await billingTestHelper.getCurrentUserService().siteApi.update({
            id: siteID,
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: {
              accountID: billingAccount.id,
              platformFeeStrategy
            }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);

          siteResponse = await billingTestHelper.getCurrentUserService().siteApi.readById(siteID);
          expect(siteResponse.data.accountData.accountID).to.eq(billingAccount.id);
          expect(siteResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        xit('should send account onboarding', async () => {
        // Already tested
          let response = await billingTestHelper.getCurrentUserService().billingApi.createBillingAccount({
            businessOwnerID: billingTestHelper.getCurrentUserContext().id
          });
          expect(response.status).to.be.eq(StatusCodes.OK);
          response = await billingTestHelper.getCurrentUserService().billingApi.onboardBillingAccount(response.data.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          response = await billingTestHelper.getCurrentUserService().billingApi.readBillingAccount(response.data.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.status).to.be.eq(BillingAccountStatus.PENDING);
        });

        it('should not able to send account onboarding for an activated account', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          const response = await billingTestHelper.getCurrentUserService().billingApi.onboardBillingAccount(billingAccount.id);
          expect(response.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });
      });

      describe('Transfers', () => {

        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        // Set the admin as the current user context
          billingTestHelper.setCurrentUserContextAsAdmin();
        });

        it('should list transfers', async () => {
          const transfer = BillingTransferFactory.build();
          const transferID = await BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer);
          transfer.id = transferID;
          // const transfersResponse = await billingTestHelper.getCurrentUserService().billingApi.readTransfers({},{ limit: 1, skip: 0 }, [{ field: '-createdOn' }]);
          const transfersResponse = await billingTestHelper.getCurrentUserService().billingApi.readTransfers({ ID: transferID });
          expect(transfersResponse.status).to.be.eq(StatusCodes.OK);
          const savedTransfer = transfersResponse.data.result?.[0];
          expect(savedTransfer).not.to.be.null;
          delete savedTransfer.createdOn;
          delete savedTransfer.createdBy;
          delete savedTransfer.lastChangedOn;
          delete savedTransfer.lastChangedBy;
          expect(savedTransfer).to.containSubset(transfer);
        });

        it('should finalize transfer', async () => {
          const billingAccount = await billingTestHelper.getActivatedAccount();
          const transfer: BillingTransfer = { ...BillingTransferFactory.build(), accountID: billingAccount.id, status: BillingTransferStatus.DRAFT };
          const transferID = await BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer);
          transfer.id = transferID;
          const finalizeResponse = await billingTestHelper.getCurrentUserService().billingApi.finalizeTransfer(transferID);
          expect(finalizeResponse.status).to.be.eq(StatusCodes.OK);
          const finalizedTransfer = await BillingStorage.getTransferByID(billingTestHelper.getTenant(), transferID);
          expect(finalizedTransfer.status).to.eq(BillingTransferStatus.FINALIZED);
        });

        it('should not finalize a draft transfer', async () => {
          const transfer = BillingTransferFactory.build();
          transfer.status = BillingTransferStatus.FINALIZED;
          const transferID = await BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer);
          transfer.id = transferID;
          const finalizeResponse = await billingTestHelper.getCurrentUserService().billingApi.finalizeTransfer(transferID);
          expect(finalizeResponse.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });

        it('should send a transfer', async () => {
          const billingAccount = await billingTestHelper.createActivatedAccount();
          const transfer: BillingTransfer = { ...BillingTransferFactory.build(), status: BillingTransferStatus.DRAFT, accountID: billingAccount.id };
          // Only works for bank accounts using the USD currency!!!!
          // await stripeTestHelper.addFundsToBalance(transfer.totalAmount);
          transfer.id = await BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer);
          const finalizeResponse = await billingTestHelper.getCurrentUserService().billingApi.finalizeTransfer(transfer.id);
          expect(finalizeResponse.status).to.be.eq(StatusCodes.OK);
          const sendResponse = await billingTestHelper.getCurrentUserService().billingApi.sendTransfer(transfer.id);
        // Does not yet work as expected - funds cannot be sent because of the balance
        // expect(sendResponse.status).to.be.eq(StatusCodes.OK);
        });
      });

      describe('Invoicing', () => {


        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        // Set the admin as the current user context
          billingTestHelper.setCurrentUserContextAsAdmin();
          // Initialize the charging station context
          await billingTestHelper.initContext2TestConnectedAccounts();
        });

        describe('with Periodic Billing ON ', () => {
          beforeAll(async () => {
          // Initialize the Billing module
            await billingTestHelper.setBillingSystemValidCredentials(true, false /* immediateBillingAllowed OFF */);
          });

          // -------------------------------------------------------------------------------------------------------------
          // TO DO - GENERATE SEVERAL TRANSACTIONS
          // -------------------------------------------------------------------------------------------------------------
          // - create and onboard two accounts
          // - assign a account at a company level (with a platform fee strategy)
          // - Override the account at a site level (with a distinct platform fee strategy)
          // - Generate several transactions
          // - Make sure to select the periodic billing mode and generate DRAFT invoices
          // - Make sure to have several sessions per invoices
          // - Make sure each invoices targets SEVERAL SUB-ACCOUNTS
          // - force the periodic billing and thus GENERATE SEVERAL TRANSFERS
          // - finalize the transfers!!!!
          // - send the transfers to STRIPE to generate the real transfer of funds
          // -------------------------------------------------------------------------------------------------------------
          it('should create an invoice, and get transfers generated', async () => {
          // Create a account
            await billingTestHelper.makeCurrentUserContextReadyForBilling();
            // Generate a DRAFT transaction
            const transactionID1 = await billingTestHelper.generateTransactionAndCheckBillingStatus(BillingInvoiceStatus.DRAFT);
            const transactionID2 = await billingTestHelper.generateTransactionAndCheckBillingStatus(BillingInvoiceStatus.DRAFT);
            // Let's simulate the periodic billing operation
            const taskConfiguration: BillingPeriodicOperationTaskConfig = {
              onlyProcessUnpaidInvoices: false,
              forceOperation: true
            };
            const operationResult: BillingChargeInvoiceAction = await billingTestHelper.billingImpl.chargeInvoices(taskConfiguration);
            assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
            assert(operationResult.inError === 0, 'The operation should detect any errors');
            // The transaction should now have a different status and know the final invoice number
            const billingDataStop1 = await billingTestHelper.checkTransactionBillingData(transactionID1, BillingInvoiceStatus.PAID);
            const billingDataStop2 = await billingTestHelper.checkTransactionBillingData(transactionID2, BillingInvoiceStatus.PAID);
            // Check billing data
            assert(billingDataStop1.invoiceID === billingDataStop2.invoiceID, 'The two transactions should be billed by a single invoice');
            await billingTestHelper.checkInvoiceData(billingDataStop1.invoiceID, BillingInvoiceStatus.PAID, 2, 20.16);
            // The user should have no DRAFT invoices
            const nbDraftInvoices = await billingTestHelper.checkForDraftInvoices();
            assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
          // TODO - check the generated transfer
          });
        });

        describe('with Immediate Billing ON ', () => {
          beforeAll(async () => {
          // Initialize the Billing module
            await billingTestHelper.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
          });

          it('should create an invoice, pay for it immediately and get a transfer generated or updated', async () => {
          // Create a account
            await billingTestHelper.makeCurrentUserContextReadyForBilling();
            // Generate a PAID transaction
            const transactionID = await billingTestHelper.generateTransactionAndCheckBillingStatus(BillingInvoiceStatus.PAID);
            // The transaction should now have a different status and know the final invoice number
            const billingDataStop = await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
            // Check billing data
            await billingTestHelper.checkInvoiceData(billingDataStop.invoiceID, BillingInvoiceStatus.PAID, 1, 10.08);
            // The user should have no DRAFT invoices
            const nbDraftInvoices = await billingTestHelper.checkForDraftInvoices();
            assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
          // TODO - check the generated transfer
          });
        });

      });
    });

    describe('Where basic user', () => {

      beforeAll(async () => {
        await billingTestHelper.setBillingSystemValidCredentials();
      });

      describe('Connected Accounts', () => {

        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Set the basic user as the current user context
          billingTestHelper.setCurrentUserContextAsBasic();
        });

        it('should not be able to create a account', async () => {
          const response = await billingTestHelper.getCurrentUserService().billingApi.createBillingAccount({
            businessOwnerID: billingTestHelper.getCurrentUserContext().id
          });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('should not activate an inexistent account', async () => {
          const activationResponse = await billingTestHelper.getCurrentUserService().billingApi.activateBillingAccount({
            accountID: '5ce249a1a39ae1c056c389bd', // inexistent account
            TenantID: billingTestHelper.getTenantID()
          });
          expect(activationResponse.status).to.be.eq(StatusCodes.NOT_FOUND);
        });

        it('should not be able to list accounts', async () => {
          const response = await billingTestHelper.getCurrentUserService().billingApi.readBillingAccounts({});
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('should not be able to read account', async () => {
        // List accounts
          const response = await billingTestHelper.getCurrentUserService().billingApi.readBillingAccount('62978713f146ea8cb3bf8a95'); // inexistent account
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('should not be able to send account onboarding', async () => {
        // List accounts
          const response = await billingTestHelper.getCurrentUserService().billingApi.onboardBillingAccount('62978713f146ea8cb3bf8a95'); // inexistent account
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });
      });

      describe('Transfers', () => {

        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Set the basic user as the current user context
          billingTestHelper.setCurrentUserContextAsBasic();
        });

        it('should not be able to list transfers', async () => {
          const transfersResponse = await billingTestHelper.getCurrentUserService().billingApi.readTransfers({});
          expect(transfersResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('should not be able to finalize a transfer', async () => {
          const finalizeResponse = await billingTestHelper.getCurrentUserService().billingApi.finalizeTransfer('5ce249a1a39ae1c056c389bd'); // inexistent transfer
          expect(finalizeResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('should not be able to send a transfer invoice', async () => {
          const sendResponse = await billingTestHelper.getCurrentUserService().billingApi.sendTransfer('5ce249a1a39ae1c056c389bd'); // inexistent transfer
          expect(sendResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
        });
      });
    });

    describe('Transfer Storage', () => {
      it('should save a billing transfer', async () => {
        const transfer = BillingTransferFactory.build();
        const transferID = await BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer);
        expect(transferID).to.not.be.null;

        const retrievedTransfer = await BillingStorage.getTransferByID(billingTestHelper.getTenant(), transferID);
        expect(retrievedTransfer).to.containSubset(transfer);
      });

      it('should list billing transfers', async () => {
        const transfers = [
          BillingTransferFactory.build(),
          BillingTransferFactory.build(),
        ];
        const ids = await Promise.all(transfers.map(async (transfer) => BillingStorage.saveTransfer(billingTestHelper.getTenant(), transfer)));
        const retrievedTransfers = await BillingStorage.getTransfers(billingTestHelper.getTenant(), {}, Constants.DB_PARAMS_MAX_LIMIT);
        expect(retrievedTransfers.result.map((transfer) => transfer.id)).to.include.members(ids);
      });
    });

  });

});
