const https = require("https");

async function convertCurrency(from, to, amount) {
    const httpURLPath = `/exchangerates_data/convert?to=${to}&from=${from}&amount=${amount}`;
    const options = {
        hostname: "api.apilayer.com",
        port: 443,
        path: httpURLPath,
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            apikey: "xst3wL4iJdZv1Tu1XPvtWrh6FYWbXrTm",
        },
    };

    try {
        const result = await httpRequest(options)
        return String(result.body.result);
    } catch (error) {
        return null;
    }
}

function httpRequest(options, body) {
    return new Promise((resolve, reject) => {
        try {
            let bodyString = "";
            if (body) {
                bodyString = JSON.stringify(body);
                bodyString = bodyString == "{}" ? "" : bodyString;
            }

            const req = https.request(options, (res) => {
                let response = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: "",
                };

                res.on("data", (data) => {
                    response.body += data;
                });

                res.on("end", () => {
                    response.body = response.body
                        ? JSON.parse(response.body)
                        : {};
                    if (response.statusCode !== 200) {
                        return reject(response);
                    }

                    return resolve(response);
                });
            });

            req.on("error", (error) => {
                return reject(error);
            });

            req.write(bodyString);
            req.end();
        } catch (err) {
            return reject(err);
        }
    });
}

module.exports = { convertCurrency };
