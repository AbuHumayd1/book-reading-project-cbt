export default async (req) => {
  /*
   * =========================================================
   * DIC / BOOK READING PROJECT
   * Netlify API Proxy
   *
   * Frontend
   *     ↓
   * /api
   *     ↓
   * Netlify Function
   *     ↓
   * Google Apps Script
   *     ↓
   * Google Sheets
   * =========================================================
   */

  try {

    /* =======================================================
       ONLY POST REQUESTS ARE ALLOWED
       ======================================================= */

    if (req.method !== "POST") {

      return jsonResponse(
        {
          success: false,
          message: "Method not allowed."
        },
        405
      );
    }


    /* =======================================================
       READ REQUEST BODY
       ======================================================= */

    let body;

    try {

      body =
        await req.json();

    } catch (error) {

      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request."
        },
        400
      );
    }


    /* =======================================================
       VALIDATE REQUEST
       ======================================================= */

    if (
      !body ||
      typeof body !== "object"
    ) {

      return jsonResponse(
        {
          success: false,
          message: "Invalid request body."
        },
        400
      );
    }


    const action =
      body.action;


    const data =
      body.data || {};


    if (!action) {

      return jsonResponse(
        {
          success: false,
          message: "API action is required."
        },
        400
      );
    }


    /* =======================================================
       APPS SCRIPT URL
       ======================================================= */

    const appsScriptUrl =
      process.env.APPS_SCRIPT_URL;


    if (!appsScriptUrl) {

      console.error(
        "APPS_SCRIPT_URL environment variable is missing."
      );


      return jsonResponse(
        {
          success: false,
          message:
            "The API is not configured correctly. Please contact the administrator."
        },
        500
      );
    }


    /* =======================================================
       ALLOWED ACTIONS
       ======================================================= */

    /*
     * We keep a whitelist here.
     *
     * The frontend can ONLY ask the Apps Script backend
     * to perform one of these operations.
     *
     * It cannot send arbitrary function names.
     */

    const allowedActions = [

      "loginStudent",

      "getBooks",

      "getBook",

      "getQuestions",

      "startAttempt",

      "submitAttempt",

      "terminateAttempt"

    ];


    if (
      !allowedActions.includes(
        action
      )
    ) {

      return jsonResponse(
        {
          success: false,
          message:
            "Unknown or unauthorized API action."
        },
        403
      );
    }


    /* =======================================================
       FORWARD REQUEST TO GOOGLE APPS SCRIPT
       ======================================================= */

    const appsScriptResponse =
      await fetch(
        appsScriptUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(
            {
              action: action,
              data: data
            }
          )
        }
      );


    /* =======================================================
       READ APPS SCRIPT RESPONSE
       ======================================================= */

    const responseText =
      await appsScriptResponse.text();


    let responseData;


    try {

      responseData =
        JSON.parse(
          responseText
        );

    } catch (error) {

      console.error(
        "Invalid response from Google Apps Script:",
        responseText
      );


      return jsonResponse(
        {
          success: false,
          message:
            "The examination server returned an invalid response."
        },
        502
      );
    }


    /* =======================================================
       FORWARD RESPONSE TO FRONTEND
       ======================================================= */

    return jsonResponse(
      responseData,
      appsScriptResponse.status
    );


  } catch (error) {

    /* =======================================================
       GENERAL SERVER ERROR
       ======================================================= */

    console.error(
      "NETLIFY API ERROR:",
      error
    );


    return jsonResponse(
      {
        success: false,

        message:
          error?.message ||
          "An unexpected server error occurred."
      },
      500
    );
  }
};


/* =========================================================
   JSON RESPONSE HELPER
   ========================================================= */

function jsonResponse(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status: status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"
      }
    }
  );
}