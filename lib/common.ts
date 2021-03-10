
/**
 * (C) Copyright IBM Corp. 2020.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios";
import {
  Authenticator, UserOptions
} from 'ibm-cloud-sdk-core';
import os = require('os');

// tslint:disable-next-line:no-var-requires
const pkg = require('../package.json');

export type SdkHeaders = {
  'User-Agent': string;
}

/**
 * Get the request headers to be sent in requests by the SDK.
 *
 * If you plan to gather metrics for your SDK, the User-Agent header value must
 * be a string similar to the following:
 * my-node-sdk/0.0.1 (lang=node.js; os.name=Linux; os.version=19.3.0; node.version=v10.15.3)
 *
 * In the example above, the analytics tool will parse the user-agent header and
 * use the following properties:
 * "my-node-sdk" - the name of your sdk
 * "0.0.1"- the version of your sdk
 * "lang=node.js" - the language of the current sdk
 * "os.name=Linux; os.version=19.3.0; node.version=v10.15.3" - system information
 *
 * Note: It is very important that the sdk name ends with the string `-sdk`,
 * as the analytics data collector uses this to gather usage data.
 */
const adminServiceBaseUrl = "https://compliance.cloud.ibm.com/admin/v1"
export function getSdkHeaders(serviceName: string, serviceVersion: string, operationId: string): SdkHeaders | {} {

  const sdkName = "ibm-security-advisor-node-sdk";
  const sdkVersion = pkg.version;
  const osName = os.platform();
  const osVersion = os.release();
  const nodeVersion = process.version;

  const headers = {
    'User-Agent': `${sdkName}/${sdkVersion} (lang=node.js; os.name=${osName} os.version=${osVersion} node.version=${nodeVersion})`,
  }

  return headers;
}

const parseJwt = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], "base64").toString("binary"));
  } catch (e) {
    return null;
  }
};

async function getLocationDetails(accountId: string, headers: any): Promise<object>{
  let url = `${adminServiceBaseUrl}/accounts/${accountId}/settings`
  let resp = await axios.get(url, headers)
  const locationId = resp.data.location.id

  url = `${adminServiceBaseUrl}/locations/${locationId}`
  resp = await axios.get(url, headers)
  return resp.data
}

async function getAccountId(authenticator: Authenticator, headers: any): Promise<string> {
  await authenticator.authenticate(headers)
  const parsedToken = parseJwt(headers.headers["Authorization"].substring(7))
  return parsedToken.account.bss
}

export async function getServiceURL(options: UserOptions, service: string): Promise<string>{
  try{
    const headers = {headers:{"Content-Type": "application/json"}}
    const accountId = await getAccountId(options.authenticator, headers)
    if(!accountId){
      return Promise.reject(new Error("Failed to fetch location details for the user. Make sure the api key/bearer token you entered in correct.")) 
    }
    const locationDetails = await getLocationDetails(accountId, headers)
    if(options.serviceUrl){
      if(locationDetails[`si_${service}_endpoint_url`] !== options.serviceUrl){
        return Promise.reject(new Error(`The service URL you specified is incorrect for the location selected for the account. The correct URL is: ${locationDetails[`si_${service}_endpoint_url`]}`)) 
      }
    }
    return locationDetails[`si_${service}_endpoint_url`]
  }catch(err){
    return Promise.reject(err)
  }
  
}
