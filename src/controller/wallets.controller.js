const {
    User,
    Wallets,
    Accounts,
    Transactions,
    Products,
    PaymentLinks,
} = require("../model");
const { genHash, compareHash, genId, genUnique } = require("../helpers");
const sendResponse = require("../helpers/response");
const { validateEmail, validatePhonenumber } = require("../utils/validate");
const {
    genAccessToken,
    genRefreshToken,
    verifyToken,
} = require("../helpers/token");
const Fetch = require("../utils/fetch");
const {
    createPersonalWallet,
    createCompanyWallet,
} = require("../config/rapydEndpoints");

const { convertCurrency } = require("../services");

class WalletController {
    async addFund(res, payload) {
        try {
            let result = await Fetch(
                "POST",
                "/v1/issuing/bankaccounts/bankaccounttransfertobankaccount",
                payload
            );
            let message = result.statusCode == 200 ? "success" : "failed";
            let status = result.statusCode == 200 ? true : false;
            sendResponse(
                res,
                result.statusCode,
                status,
                message,
                result.body.data
            );
        } catch (e) {
            sendResponse(
                res,
                500,
                false,
                `Error: ${e.body.status.message}`,
                e.body
            );
        }
    }

    async withdrawFund(res, payload) {
        const { id } = res.user;
        const { wId } = await Wallets.findOne({ userId: id });

        // Add Ewallet to payload
        payload.ewallet = wId;

        if (wId) {
            try {
                let result = await Fetch("POST", "/v1/account/withdraw", payload);
                let message = result.statusCode == 200 ? "Funds withdraw successfull" : "Failed to withdraw fund.";
                let status = result.statusCode == 200 ? true : false;
                sendResponse(
                    res,
                    result.statusCode,
                    status,
                    message,
                    result.body.data
                );
            }
            catch (e) {
                console.log(e);
                sendResponse(res, 500, false, "An Error occured while withdrawing.");
            }
        } else {
            sendResponse(res, 400, false, "Error Getting Ewallet", {});
        }
    }

    async createAccount(res, payload, paymentLinkId, paymentCookie) {
        if (!paymentLinkId) {
            return sendResponse(res, 500, false, "Invalid Payment Link id", {});
        }

        try {
            // Verify Payment Link and Get Price
            let paymentPrice;
            let userId = null;
            let currency = "USD"; // Default

            try {
                const payLink = await PaymentLinks.findOne({
                    id: paymentLinkId,
                });
                if (!payLink) {
                    return sendResponse(
                        res,
                        500,
                        false,
                        "Payment Link Not Found",
                        {}
                    );
                }

                // Get Data From Payment Link
                userId = payLink.userId;

                let { currency } = await User.findOne({ id: userId });

                payload.currency =
                    typeof payload.currency === "undefined"
                        ? currency
                        : payload.currency;
                payload.country =
                    typeof payload.country === "undefined"
                        ? payLink.country
                        : payload.country;

                // Get Amount In Customer's Currency
                paymentPrice = await convertCurrency(
                    currency,
                    payload.currency,
                    payLink.amount
                );

                payload.description =
                    typeof payload.description === "undefined"
                        ? payLink.title
                        : payload.description;
                payload.ewallet = payLink.wId;
            } catch (e) {
                return sendResponse(
                    res,
                    500,
                    false,
                    "Payment Link Not Found",
                    {}
                );
            }

            // Get Wallet
            const getWallet = await Wallets.findOne({ userId });

            if (!getWallet) {
                return sendResponse(res, 500, false, "Wallet Id Not Found", {});
            }

            const name = payload?.name || "";
            const email = payload?.email || "";

            // Delete name and email From Object
            delete payload.name;
            delete payload.email;


            // Check if there is already a transaction stored
            if (paymentCookie !== "") {
                // Check if Transaction Exists in our DB
                const checkTransaction = await Transactions.findOne({
                    id: paymentCookie
                });

                if (checkTransaction) {
                    // Retrieve Virtual Account
                    let result = await Fetch(
                        "GET",
                        "/v1/issuing/bankaccounts/" + paymentCookie
                    );

                    let message =
                        result.statusCode == 200
                            ? "Vitual Account Retrieved"
                            : "Failed To Retrieve Vitual Account";
                    let status = result.statusCode == 200 ? true : false;

                    if (status) {
                        return sendResponse(
                            res,
                            result.statusCode,
                            status,
                            message,
                            result.body.data
                        );
                    }
                }
            }

            console.log("Not Logged If Cookie is Used");

            try {
                let result = await Fetch(
                    "POST",
                    "/v1/issuing/bankaccounts",
                    payload
                );
                let message =
                    result.statusCode == 200
                        ? "Vitual Account Created"
                        : "Failed To Create Vitual Account";
                let status = result.statusCode == 200 ? true : false;

                if (status) {
                    // const bankName = result.body.data.bank_account.account_number || "";
                    // const bic = result.body.data.bank_account.account_number || "";
                    // const routingNumber = result.body.data.bank_account.aba_routing_number || "";

                    const iban =
                        result.body.data.bank_account.account_number || "";
                    const county =
                        result.body.data.bank_account.county_iso || "";
                    const currency = result.body.data.currency || "";
                    const accountId = result.body.data.id;
                    const description = result.body.data.description || "";
                    const walletId = payload.ewallet;

                    try {
                        // Create Empty Transaction
                        const createTransaction = await Transactions.create({
                            id: accountId,
                            userId,
                            linkId: paymentLinkId,
                            currency,
                            name,
                            email,
                            paid: 0,
                            totalAmount: paymentPrice,
                            iban,
                            createdAt: Date.now(),
                            status: "Created",
                        });

                        // Store Transaction in Cookie
                        res.cookie(paymentLinkId, accountId, {
                            httpOnly: true,
                            secure: false,
                            sameSite: "none",
                        });

                        result.body.data.accountId = accountId;

                        sendResponse(
                            res,
                            result.statusCode,
                            status,
                            message,
                            result.body.data
                        );
                    } catch (e) {
                        console.log(e);
                        sendResponse(
                            res,
                            500,
                            false,
                            `Error Creating Account`,
                            {},
                            e.body
                        );
                    }
                }
            } catch (e) {
                console.log(e);
                sendResponse(
                    res,
                    500,
                    false,
                    `Error: ${e.body.status.message}`,
                    {},
                    e.body
                );
            }
        } catch (e) { }
    }

    async getWallet(res, id) {
        // check if users exists first
        const userId = res.user.id;

        if (id !== userId) return sendResponse(res, 404, false, "failed to retrieve wallet: user not found.")

        const getUser = await Wallets.findOne({ userId: id });

        const getUserInfo = await User.findOne({ id: userId })

        if (getUser) {
            id = getUser.wId;
        }

        try {
            let result = await Fetch("GET", "/v1/user/" + id);
            let message =
                result.statusCode == 200
                    ? "wallet retrieved successfully"
                    : "failed to retrieve wallet";
            let status = result.statusCode == 200 ? true : false;

            const { country, currency } = getUserInfo;
            result.body.data.country = country;
            result.body.data.currency = currency;

            sendResponse(
                res,
                result.statusCode,
                status,
                message,
                result.body.data
            );
        } catch (e) {
            sendResponse(res, 500, false, "failed to retrieve wallet", {});
        }
    }

    async getIdType(res, payload) {
        try {
            let result = await Fetch(
                "GET",
                "/v1/identities/types?country=" + payload
            );
            let message =
                result.statusCode == 200
                    ? "ID Types retrieved successfully"
                    : "failed to retrieve ID Types";
            let status = result.statusCode == 200 ? true : false;
            sendResponse(
                res,
                result.statusCode,
                status,
                message,
                result.body.data
            );
        } catch (e) {
            sendResponse(res, 500, false, "Something went wrong", {});
        }
    }

    async verifyIdentity(res, payload) {
        const { id } = res.user;

        try {
            const getWallet = await Wallets.findOne({ userId: id });
            const walletId = getWallet.wId;

            payload.ewallet = walletId;

            let result = await Fetch("POST", "/v1/identities", payload);
            let message = result.statusCode == 200 ? "success" : "failed";
            let status = result.statusCode == 200 ? true : false;
            sendResponse(
                res,
                result.statusCode,
                status,
                message,
                result.body.data
            );
        } catch (e) {
            sendResponse(
                res,
                500,
                false,
                `Error: ${e.body.status.message}`,
                {},
                e.body
            );
        }
    }

    async webhook(res, payload) {
        console.log(payload);

        // Identity Verification
        if (payload.type === "IDENTITY_VERIFICATION") {
            // Update wallet verification status
            const walletId = payload.data.ewallet;
            const verificationStatus = payload.data.verification_status;

            try {
                if (verificationStatus === "NOT_APPROVED") {
                    const updateWallet = await Wallets.updateOne(
                        { wId: walletId },
                        { verified: false, status: "failed" }
                    );
                } else {
                    const updateWallet = await Wallets.updateOne(
                        { wId: walletId },
                        { verified: true, status: "verified" }
                    );
                }
            } catch (e) {
                console.log(e);
            }
        } else if (
            payload.type === "ISSUING_DEPOSIT_COMPLETED" &&
            payload.status === "NEW"
        ) {
            // Bank Account Deposit

            const accountId = payload.data.issued_account_id;
            const getTransaction = await Transactions.findOne({
                id: accountId,
            });

            // Check if Transaction Exists
            if (getTransaction) {
                const paid = Number(getTransaction.paid);
                const total = Number(getTransaction.totalAmount);

                const amount = Number(payload.data.amount);

                const newPaid = paid + amount;

                // Check If Payment is Complete
                if (newPaid >= total) {
                    await Transactions.updateOne(
                        { id: accountId },
                        {
                            paid: newPaid,
                            status: "Paid",
                        }
                    );
                } else {
                    await Transactions.updateOne(
                        { id: accountId },
                        {
                            paid: newPaid,
                            status: "Updated",
                        }
                    );
                }
            }
        }

        sendResponse(res, 200, true, "Webhook Endpoint", {});
    }
}

module.exports = WalletController;
