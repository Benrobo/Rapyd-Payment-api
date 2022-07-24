const mailer = require("nodemailer");
const fs = require("fs");

let transporter = mailer.createTransport({
    host: "vmi807529.contaboserver.net",
    port: 25,
    secure: false, // true for 465, false for other ports
    auth: {
        user: "info@raypal.finance", // generated ethereal user
        pass: "brI1HEw4EnJI", // generated ethereal password
    },
    tls: {
        rejectUnauthorized: false,
    },
});

const COMPANY = "RayPal";
const URL = "https://raypal.finance";

function makeTemplate(name, email, title, message) {
    let mail = fs.readFileSync(__dirname + "/welcome.html", "utf-8");
    return mail
        .replaceAll("{{company}}", COMPANY)
        .replaceAll("{{url}}", URL)
        .replaceAll("{{name}}", name)
        .replaceAll("{{email}}", email)
        .replaceAll("{{message}}", message)
        .replaceAll("{{title}}", title);
}

async function sendMail(name, email, title, message) {
    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: '"RayPal " <info@raypal.finance>', // sender address
        to: email, // list of receivers
        subject: title, // Subject line
        html: makeTemplate(name, email, title, message), // html body
    });
    console.log(info);
}

sendMail(
    "Dev Bash",
    "nilujef.duhimog@vintomaper.com",
    "Testing",
    "Hello World!"
);

module.exports = { sendMail };
