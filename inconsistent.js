const json_schema = {
  "name": "smart_home_hub",
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name of the product."
      },
      "description": {
        "type": ["string", "null"],
        "description": "Description of the product. Can be up to three sentences."
      },
      "price": {
        "type": "number",
        "description": "Price of the product, in the original currency."
      },
      "currency": {
        "type": "string",
        "description": "Currency for the price, e.g. USD. Use three-letter abbreviations. If there is no data, default to USD."
      },
      "manufacturer": {
        "type": ["string", "null"],
        "description": "Manufacturer of the product."
      },
      "category": {
        "type": ["string", "null"],
        "description": "Category of the product."
      },
      "inStock": {
        "type": "boolean",
        "description": "Boolean representing whether the product is in stock. If there is no data, default to true."
      },
      "weight": {
        "type": ["number", "null"],
        "description": "Weight of the product in kilograms."
      },
      "dimensions": {
        "type": ["string", "null"],
        "description": "Dimensions of the product. Do not try to standardize this field."
      },
      "color": {
        "type": ["string", "null"],
        "description": "Color of the product, in all lowercase."
      }
    },
    "required": [
      "name",
      "description",
      "price",
      "currency",
      "manufacturer",
      "category",
      "inStock",
      "weight",
      "dimensions",
      "color"
    ],
    "additionalProperties": false
  },
  "strict": true
};

async function transform(record, helper) {
  const newRecord = await askGPT({
    apiKey: helper.secrets.get("OPENAI_API_KEY"),
    userPrompt: JSON.stringify(record),
    model: "gpt-4o-mini",
    systemPrompt: 'You are standardizing a product catalog made up of product records from many sources. Pick out information from the inputted JSON and use it to create the output JSON according to the schema. Do not make up any answers from your knowledge - only use information from the input.Do not summarize any information.',
    json_schema
  });

  if (newRecord.currency == "USD") {
    delete newRecord.currency;
  } else {
    const currencyAPIResult = await fetch(`https://api.currencyapi.com/v3/latest?apikey=${helper.secrets.get('currencyApiKey')}&currencies=USD&base_currency=${newRecord.currency}`)

    if (!currencyAPIResult.ok) {
      console.error('Failed to fetch currency data - ' + (await currencyAPIResult.text()));
      // in the event of a failed conversion, we'll just keep the currency value around for debugging and then null the price value so as to indicate an invalid price.
      newRecord.price = null;
    } else {
      const jsonResult = await currencyAPIResult.json();
      if (!jsonResult.data["USD"]) {
        console.error(`Unable to find USD in the response`);
        // in this error case, do the same thing as above
        newRecord.price = null;
      } else {
        newRecord.price = Number((newRecord.price * jsonResult.data["USD"].value).toFixed(2)); // caps at two decimal places
        delete newRecord.currency;
      }
    }
  }

  newRecord.objectID = record.objectID;

  return newRecord;
}

async function askGPT(config) {
  const apiUrl = 'https://api.openai.com/v1/chat/completions';

  const messages = [{
    role: 'user',
    content: config.userPrompt
  }];
  if (config.systemPrompt) {
    messages.push({
      role: 'system',
      content: config.systemPrompt
    });
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: config.json_schema
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('LLM returned an error:', errorData.error?.message);
    return null;
  }

  const completion = await response.json();
  const completionMessage = completion.choices[0].message
  
  if (completionMessage.refusal) {
    console.error('LLM refused to fulfill this request.');
  } else {
    return JSON.parse(completionMessage.content);
  }
}
