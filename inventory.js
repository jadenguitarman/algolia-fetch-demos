async function transform(record, helper) {
  const totalStock = Object.values(record.warehouses).reduce((acc, cur) => acc + cur, 0);
  if (totalStock == 0) {
    record.stock = "out";
  } else if (totalStock < 10) {
    record.stock = "low";
  } else {
    record.stock = "in";
  }
  delete record.warehouses;

  record = {
    ...record,
    ...getProductFromShopify(record.objectID),
    price: getDynamicPricingData(record.objectID)
  }
}

const getProductFromShopify = async (objectID) => {
	const productData = {
    "name": "Smart Home Hub",
    "description": "Control all your smart devices from one central hub",
    "price": 149.99,
    "currency": "USD",
    "manufacturer": "TechConnect",
    "category": "Smart Home",
    "weight": 0.5,
    "dimensions": "4x4x2",
    "color": "White"
  };
	
	return {
		objectID,
		...productData
	}
}

const getDynamicPricingData = async (objectID) => Number((Math.random() * 1000).toFixed(2));