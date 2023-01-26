const { spawn } = require("child_process");
const fs = require("fs");

function getUniqueFileName(prefix, suffix) {
    let now = new Date(),
        randomNumber = Math.floor(Math.random() * 1000000000),
        newFileName = prefix + "_";
    newFileName += now.getFullYear().toString();
    newFileName += (now.getMonth() < 9 ? "0": "") + (now.getMonth() + 1).toString();
    newFileName += (now.getDate() < 10 ? "0" : "") + now.getDate().toString();
    newFileName += "_";
    newFileName += (now.getHours() < 10 ? "0": "") + now.getHours().toString();
    newFileName += (now.getMinutes() < 10 ? "0": "") + now.getMinutes().toString();
    newFileName += (now.getSeconds() < 10 ? "0": "") + now.getSeconds().toString();
    newFileName += "_";
    newFileName += randomNumber.toString(10);
    newFileName += suffix;
    return newFileName;
}

module.exports = function (event, options = []) {
    return new Promise(((resolve, reject) => {
        const bufs = [];

        let command = "lib/wkhtmltopdf",
            specifiedParameters = ~Object.keys(event).indexOf("params") ? event.params : {},
            filesToDelete = [];
        Object.keys(specifiedParameters).forEach(paramName => {
            // If the parameter is the header or footer, we need to save it to a temp file first, and use the temp file path instead of the header HTML.
            if (~["--footer-html", "--header-html"].indexOf(paramName)) {
                let fileNamePrefix = paramName === "--header-html" ? "header" : "footer";
                    htmlFileName = getUniqueFileName(fileNamePrefix, ".html");
                while (fs.existsSync(`/tmp/${htmlFileName}`))
                    htmlFileName = getUniqueFileName(fileNamePrefix, ".html");
                fs.writeFileSync(`/tmp/${htmlFileName}`, specifiedParameters[paramName]);
                command += `${paramName} /tmp/${htmlFileName}`;
                filesToDelete.push(`/tmp/${htmlFileName}`);
            } else {
                command += paramName;
                // Did they provide a value with the parameter?
                if (specifiedParameters[paramName] !== null)
                    command += " " + specifiedParameters[paramName];
            }
        });
        command += " - - | cat";

        const proc = spawn("/bin/sh", ["-o", "pipefail", "-c", command]);

        proc.on("error", error => {
            reject(error);
        }).on("exit", code => {
            // Clean up our temp files first
            filesToDelete.forEach(fileName => fs.unlinkSync(fileName));
            
            if (code) {
                reject(new Error(`wkhtmltopdf process exited with code ${code}`));
            } else {
                resolve(Buffer.concat(bufs));
            }
        });

        proc.stdin.end(event.html);

        proc.stdout.on("data", data => {
            bufs.push(data);
        }).on("error", error => {
            reject(error);
        });
    }));
};