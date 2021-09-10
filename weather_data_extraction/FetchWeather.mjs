import fetch from "node-fetch";
import requirejs from "requirejs"

const apiKey = "79f8ca5aa22a46ebb9192046210809"

const getRequestLink = (city, startDate, endDate) => (`http://api.worldweatheronline.com/premium/v1/past-weather.ashx?
key=${apiKey}
&q=${city}
&format=json
&date=${startDate}
&enddate=${endDate}`);

const startDate = "2009-01-01"
const findCity = "Delhi" // Change This For Different

/** For whole day */
const directParams = {
    "date": (dayData) => dayData["date"],
    "Max Temp (°c)": (dayData) => dayData["maxtempC"],
    "Min Temp (°c)": (dayData) => dayData["mintempC"],
    "Avg Temp (°c)": (dayData) => dayData["avgtempC"],
    "Snow (cm)": (dayData) => dayData["totalSnow_cm"],
    "Sun Time (Hours)": (dayData) => dayData["sunHour"],
    "UV Index": (dayData) => dayData["uvIndex"]
}

/** Derived from hourly, To add more params, insert in this object with value = way of extraction */
const derivedParams = {
    "Total Precipitation (MM)":
        (hourly) => (
            hourly.map((cur) => (parseFloat(cur["precipMM"])))
                .reduce((acc, cur) => acc + cur)
        ),

    "Avg Pressure (P)":
        (hourly) => (
            hourly.map((cur) => (parseFloat(cur["pressure"]) / hourly.length))
                .reduce((acc, cur) => acc + cur)
        ),

    "Avg Humidity (%)":
        (hourly) => (
            hourly.map((cur) => (parseFloat(cur["humidity"]) / hourly.length))
                .reduce((acc, cur) => acc + cur)
        ),

    "Avg Cloud Cover":
        (hourly) => (
            hourly.map((cur) => (parseFloat(cur["cloudcover"]) / hourly.length))
                .reduce((acc, cur) => acc + cur)
        ),

    "Avg Resultant Wind vector [E, N](km/h)": // Vector addition of hourly winds
        (hourly) => {
            const windVectors = extractWindVectors(hourly);
            const resultant = windVectors.reduce((acc, cur) => ([acc[0] + cur[0], acc[1] + cur[1]]));
            return resultant.map(k => k / hourly.length)
        },
}

/** Need to do later, currently do by hand */
const fillOnOwnParams = {
    "latitude": "",
    "longitude": ""
}

const fetchAllData = async (city, startDate, endDate) => {
    if (endDate < startDate) {
        return null;
    } else {
        const response = await fetch(getRequestLink(city, startDate, endDate));
        return await response.json()
    }
}

/** Returns Extracted data and end date */
const processRawData = (rawData) => {
    if (rawData["data"]["error"] !== undefined) {
        console.error("Error Fetching data, received:", rawData["data"]["error"][0])
        return null;
    }
    if (rawData["data"]["request"][0].type !== 'City') {
        console.error("Not a city:", rawData["data"]["request"][0].query)
        return null;
    }
    let extractedData = {
        ...fillOnOwnParams,
        "city": rawData["data"]["request"][0].query,
        "dayWiseData": []
    };
    for (let i = 0; i < rawData["data"]["weather"].length; i++) {
        let newInsertion = {};
        extractedData["dayWiseData"].push(newInsertion);
        for (const directParamsKey in directParams) {
            newInsertion[directParamsKey] = directParams[directParamsKey](rawData["data"]["weather"][i])
        }
        for (const derivedParamsKey in derivedParams) {
            newInsertion[derivedParamsKey] = derivedParams[derivedParamsKey](rawData["data"]["weather"][i]["hourly"])
        }
    }
    return [
        extractedData,
        rawData["data"]["weather"]
            [(rawData["data"]["weather"]).length - 1]["date"]
    ]
}

const getAllData = async (city) => {
    let nextStart = new Date(startDate.replace( /(\d{2})-(\d{2})-(\d{4})/, "$2/$3/$1"))
    let endDate = new Date();
    let answer = null
    while (nextStart <= endDate) {
        const stringStartDate = nextStart.toISOString().split('T')[0]
        const stringEndDate = endDate.toISOString().split('T')[0]
        let got = processRawData(
            await fetchAllData(city, stringStartDate, stringEndDate)
        )
        if (got === null) {
            return null
        } else if (answer === null) {
            answer=got[0];
        } else {
            answer["dayWiseData"] = [...answer["dayWiseData"], ...got[0]["dayWiseData"]]
        }
        nextStart = new Date(got[1].replace( /(\d{2})-(\d{2})-(\d{4})/, "$2/$3/$1"))
        nextStart.setDate(nextStart.getDate() + 1)
        console.log(got[1])
    }
    return answer
}

/** Main Function */
(async () => {
    const fs = requirejs("fs");
    fs.writeFile(`${findCity}.json`, JSON.stringify(await getAllData(findCity)), (err) => {
        if (err)
            console.log(err);
        else {
            console.log("File written successfully\n");
            console.log("The written has the following contents:");
            console.log(fs.readFileSync("books.txt", "utf8"));
        }
    });
})()


/** UTILITY */
function sinDeg(degree) {
    return Number(Math.sin(degree * Math.PI / 180).toFixed(5));
}

function cosDeg(degree) {
    return Number(Math.cos(degree * Math.PI / 180).toFixed(5));
}

function extractWindVectors(hourly) {
    return hourly.map((cur) => {
        let windD = parseFloat(cur["winddirDegree"]), windS = parseFloat(cur["windspeedKmph"]);
        return [windS * cosDeg(windD), windS * sinDeg(windD)]
    })
}