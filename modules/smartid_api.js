/*jslint node: true */
'use strict';
const request = require('request');
const conf = require('ocore/conf.js');
const notifications = require('./notifications.js');

function getLoginUrl(callbackReference) {
	if (!conf.apiSmartIdToken || !conf.apiSmartIdSecret || !conf.apiSmartIdCallback || !conf.apiSmartIdRedirect) {
		throw Error("eID Easy credentials missing");
	}
	return 'https://id.eideasy.com/oauth/authorize?client_id='+ encodeURIComponent(conf.apiSmartIdToken) +'&redirect_uri=' + encodeURIComponent(conf.apiSmartIdCallback) + '&response_type=code&lang=en&state='+ encodeURIComponent(callbackReference);
}

function getAccessToken(grantCode, onDone){
	if (!conf.apiSmartIdToken || !conf.apiSmartIdSecret || !conf.apiSmartIdCallback || !conf.apiSmartIdRedirect) {
		throw Error("eID Easy credentials missing");
	}
	let headers = {
		"Content-Type": "application/json",
		"User-Agent": "Obyte attestation/1.0"
	};
	let form_data = {
		code: grantCode,
		grant_type: 'authorization_code',
		client_id: conf.apiSmartIdToken,
		client_secret: conf.apiSmartIdSecret,
		redirect_uri: conf.apiSmartIdCallback
	};
	request({
		url: "https://id.eideasy.com/oauth/access_token", 
		headers: headers, 
		method: 'POST', 
		form: form_data
	}, function (error, response, body){
		if (typeof body === 'string' && body)
			body = JSON.parse(body);
		if (error || response.statusCode !== 200){
			notifications.notifyAdmin("getAccessToken eID Easy failed", error+", status="+(response ? response.statusCode : '?'));
			return onDone("getAccessToken eID Easy failed: "+error, body);
		}
		console.log("response: ", body);
		onDone(null, body);
	});
}

function getUserData(access_token, onDone){
	if (!access_token) {
		return onDone("access_token missing");
	}
	let headers = {
		"Content-Type": "application/json",
		"User-Agent": "Obyte attestation/1.0"
	};
	request({
		url: "https://id.eideasy.com/api/v2/user_data?access_token=" + access_token, 
		headers: headers, 
		method: 'GET'
	}, function (error, response, body){
		if (typeof body === 'string' && body)
			body = JSON.parse(body);
		if (error || response.statusCode !== 200){
			notifications.notifyAdmin("getUserData eID Easy failed", error+", status="+(response ? response.statusCode : '?'));
			return onDone("getUserData eID Easy failed: "+error, body);
		}
		console.log("response: ", body);
		onDone(null, body);
	});
}

function handleData(transaction_id, body, handleAttestation){
	let data = body.status ? convertRestResponseToCallbackFormat(body) : body;
	let scan_result = (data.verificationStatus === 'APPROVED_VERIFIED') ? 1 : 0;
	let error = !scan_result ? data.verificationStatus : '';
	if (!error && (!data.idFirstName || !data.idLastName || !data.idDob || !data.idCountry)) {
		scan_result = 0;
		error = 'some required data missing';
	}
	handleAttestation(transaction_id, body, data, scan_result, error);
}

function convertRestResponseToCallbackFormat(body){
	let data = {
		idScanStatus: (body.status && body.status === 'OK') ? 'SUCCESS' : 'ERROR',
		verificationStatus: (body.error || body.error_description) ? body.error +': '+ body.error_description : 'APPROVED_VERIFIED',
		idFirstName: body.firstname ? String(body.firstname).toUpperCase() : '',
		idLastName: body.lastname ? String(body.lastname).toUpperCase() : '',
		idDob: body.birth_date ? body.birth_date : '',
		gender: '',
		personalCode: body.idcode ? body.idcode : '',
		idCountry: body.country ? body.country : '',
		idUsState: '',
		idNumber: '',
		idType: body.current_login_method ? String(body.current_login_method).toUpperCase() : '',
		idSubtype: '',
		idExpiry: (body.current_login_info && body.current_login_info.valid_to) ? body.current_login_info.valid_to : '',
		idIssuedAt: (body.current_login_info && body.current_login_info.valid_from) ? body.current_login_info.valid_from : '',
		clientIp: body.clientIp ? body.clientIp : ''
	};
	return data;
}

exports.getLoginUrl = getLoginUrl;
exports.getAccessToken = getAccessToken;
exports.getUserData = getUserData;
exports.handleData = handleData;
exports.convertRestResponseToCallbackFormat = convertRestResponseToCallbackFormat;

