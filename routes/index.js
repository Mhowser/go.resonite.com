import express from 'express';
import createError from 'http-errors';

import { preProcess } from '../helpers/preprocessing.js';

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'go.resonite.com Home'
  });
});

router.get('/session/:sessionId', (req,res, next) => handle("session", req, res, next));
router.get('/session/:sessionId/json', (req,res, next) => handleJson("session", req, res, next));

router.get('/sessions', (req, res, next) => handle("sessionList", req, res, next));
router.get('/sessions/json', (req, res, next) => handleJson("sessionList", req, res, next));

// Register world/ and record/
for (const word of ["world", "record"]) {
  router.get(`/${word}/:ownerId/:recordId`, (req,res, next) => handle("world", req, res, next));
  router.get(`/${word}/:ownerId/:recordId/json`, (req,res, next) => handleJson("world", req, res, next));
}

var baseUrl = "https://api.resonite.com";

/**
 * Gets the url for either the world or session api endpoint.
 * 
 * @param {('world'|'session'|'sessionList')} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @returns The world or session api endpoint.
 */
function getUrl(type, req) {
  switch (type) {
    case "world":
      return `${baseUrl}/users/${req.params.ownerId}/records/${req.params.recordId}/`;
    case "session":
      return `${baseUrl}/sessions/` + req.params.sessionId;
    case "sessionList":
      return `${baseUrl}/sessions`
      break;
    default:
      throw new Error(`Unknown url type: ${type}`);
  }
}

/**
 * Creates an error for the Web response of a failed call to the api.
 * 
 * @param {SessionInfoA} res The response of the api request.
 * @param {('world'|'session')} type The type of information this is whether it is a world or session.
 * @returns 
 */
async function createResoniteApiError(res, type) {
  if (res.status === 404) {
    return createError(res.status, `We couldn't find this ${type}.\n
    Check your link is valid, and that the session is still open and publicly viewable.`);
  }

  var text = await res.text();
  return createError(res.status, `Resonite API returned an error: ${text}`);
}

/**
 * Handles a request for world or session information.
 * 
 * @param {('world'|'session')} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @param {import('express').Response} res The web response object.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @returns 
 */
async function handle(type, req, res, next) {
  var apiResponse = await fetch(getUrl(type, req));
  if (!apiResponse.ok) {
    var error = await createResoniteApiError(apiResponse, type);
    return next(error);
  }

  var json = await apiResponse.json();

  if (type ==="world" && json.recordType !== "world") {
    return next(createError(400, "go.resonite.com only works for Session and world link."));
  }

  if (type === "sessionList"){
    json.title = getOpenGraphTitle(type);
  }

  json = preProcess(json, type);
  json = addMetadata(type,json);
  json.urlPath = req.getUrl();

  res.status(200).render(type, json);
}

function addMetadata(pageType, json) {
  json.bodyClass = pageType;
  json.pageType = pageType;

  return json;
}

/**
 * Handles a json request for world or session information.
 * 
 * @param {('world'|'session')} type The type of information this is whether it is a world or session.
 * @param {import('express').Request} req The web request information.
 * @param {import('express').Response} res The web response object.
 * @param {import('express').NextFunction} next The function to call to proceed to the next handler.
 * @returns 
 */
async function handleJson(type, req, res, next) {
  var apiResponse = await fetch(getUrl(type, req));
  if (!apiResponse.ok) {
    res.status(apiResponse.status);
    return next();
  }

  var json = await apiResponse.json();

  if (type ==="world" && json.recordType !== "world") {
    res.status(400);
    return next();
  }

  json = preProcess(json, type);
  // title is the TOP link
  var title = getOpenGraphTitle(type);
  res.json({
    title: title,
    author_name: title,
    author_url: req.getUrl().replace("/json",""),
    provider_name: "Resonite",
    provider_url: "https://resonite.com",
  });
}

/**
 * Generates a title for OpenGraph based on the requested type.
 * 
 * @param {('world'|'session')} type The type of information this is whether it is a world or session.
 * @returns An OpenGraph suitable title for a world or session.
 */
function getOpenGraphTitle(type) {
  var app = "Resonite";
  switch(type) {
    case "session":
      return `${app} Session`;
    case "world":
      return `${app} World`;
    case "sessionList":
      return `${app} Sessions list`;
      break;
    default:
      return `${app} World`;
  }
}

export default router;
