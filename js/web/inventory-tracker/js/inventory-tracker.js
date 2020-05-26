InventoryTracker = function(){

    // private
    let tmp = {
        aux: {
            addInventoryAmount: (id, amount) => {

                if ( !tmp.inventory[id] ){
                    tmp.aux.setInventoryAmount(id, amount);
                }
                let asset = tmp.inventory[id]['itemAssetName'];

                let old = tmp.new.get(asset);
                let newAmount = tmp.inventory[id].inStock + amount - old;
                tmp.new.set(asset, amount);
                tmp.aux.setInventoryAmount(id, newAmount);
            },
            getInventoryFp: () => {
                let total = 0;

                for ( let [id, item] of Object.entries( tmp.inventory ) ){
                    let gain = 0;
                    switch( item['itemAssetName'] ){
                        case 'small_forgepoints' : { gain = 2; break; }
                        case 'medium_forgepoints' : { gain = 5; break; }
                        case 'large_forgepoints' : { gain = 10; break; }
                    }
                    total += item.inStock * gain;
                }
                return total;
            },
            setInventoryAmount: (id, amount) => {

                if ( !id ){ return; }

                if ( !tmp.inventory[id] ){
                    tmp.inventory[id] = { inStock: 0 };
                }
                tmp.inventory[id].inStock = amount;
                // if ( tmp.inventory[id].new > 0 ){
                //     // console.log(`Reseting new for [${id}]`);
                //     // tmp.inventory[id].inStock -= tmp.inventory[id].new;
                //     // tmp.inventory[id].new = 0;
                // }
            },
        },
        debug: false,
        fp: {
            total: 0
        },
        initialized: false,
        // keep a copy of the inventory while this is work-in-progress
        inventory: {},
        new: {
            data: {
                'small_forgepoints': 0,
                'medium_forgepoints': 0,
                'large_forgepoints': 0,
            },
            get: (id) => {
                return tmp.new.data[id] | 0;
            },
            init: () => {
                tmp.new.data['small_forgepoints'] = localStorage.getItem('small_forgepoints') | 0;
                tmp.new.data['medium_forgepoints'] = localStorage.getItem('medium_forgepoints') | 0;
                tmp.new.data['large_forgepoints'] = localStorage.getItem('large_forgepoints') | 0;
            },
            reset: () => {
                tmp.new.set('small_forgepoints', 0);
                tmp.new.set('medium_forgepoints', 0);
                tmp.new.set('large_forgepoints', 0);
            },
            set: (id, value) => {
                if( tmp.new.data[id] !== undefined ){
                    tmp.new.data[id] = value;
                    localStorage.setItem(id, value);
                }
            },
        },
        updateFpStockPanel: () => {
            // StrategyPoints.ForgePointBar( tmp.fp.total );
            tmp.log(`Set ForgePointBar: ${tmp.fp.total} `);
        },
        log: (o) => {
            if ( tmp.debug ){ console.log(o); }
        }
    };


    // public
    let pub = {
        debug: () => {
            return {
                fp: tmp.fp.total,
                inventory: tmp.inventory,
                new: tmp.new.data,
            }
        },
        // fp: {
        //     addAfterLeveling: (data) => {
        //
        //         if ( data && data['responseData'] && data['responseData']['strategy_point_amount'] ) {
        //             console.log(`Received ${data.responseData.strategy_point_amount} FPs`);
        //         }
        //         else {
        //             tmp.log('Invalid data: data.responseData.strategy_point_amount');
        //         }
        //     },
        // },
        init: () => {
            if ( tmp.initialized ){ return; }
            tmp.initialized = true;

            // load new values
            tmp.new.init();
        },
        inventory: {
            resetNew: () => {
                for ( let [id, item] of Object.entries( tmp.inventory ) ){
                    tmp.new.reset();
                }
            },
            set: (data) => {

                tmp.inventory = {};

                if ( !data ){ return; }
                let items = data.filter( item => item.itemAssetName.indexOf( 'forgepoints' ) > -1 );
                for ( let [index, item] of items.entries() ) {
                    tmp.inventory[ item.id ] = item;
                }
                tmp.fp.total = tmp.aux.getInventoryFp();
                tmp.updateFpStockPanel();
            },
            update: (data) => {

                /**
                 let ID = data.responseData[0];
                 let Value = data.responseData[1];

                 if (!MainParser.Inventory[ID]) MainParser.Inventory[ID] = [];
                 MainParser.Inventory[ID]['inStock'] = Value;
                 StrategyPoints.GetFromInventory();
                  */

                if (data && ( data.length % 2 == 0 )){
                    for( var i = 0; i < data.length; i = i+2 ){
                        let id = data[i];
                        let value = data[i+1];
                        tmp.aux.setInventoryAmount(id, value);
                    }
                }
                tmp.fp.total = tmp.aux.getInventoryFp();
                tmp.updateFpStockPanel();
            },
            updateRewards: (data) => {
                if ( !data ){ return };
                for ( var i = 0; i < data.length; i++ ){
                    let item = data[i];
                    let id = item['itemId'];
                    let value = item['amount'];
                    if ( id && value ) {
                        tmp.aux.addInventoryAmount( id, value );
                    }
                }
                tmp.fp.total = tmp.aux.getInventoryFp();
                tmp.updateFpStockPanel();
            },
        },
    };

    return pub;
}();

// inventory update
FoEproxy.addHandler('InventoryService', 'getItems', (data, postData) => {
    InventoryTracker.init();
    console.log('InventoryService.getItems');
    console.log(data.responseData);
    InventoryTracker.inventory.set(data.responseData);
});

// inventory update
FoEproxy.addHandler('InventoryService', 'getInventory', (data, postData) => {
    console.log('InventoryService.getInventory');
    console.log(data.responseData.inventoryItems);
    InventoryTracker.inventory.set(data.responseData.inventoryItems);
});

// inventory update
FoEproxy.addHandler('InventoryService', 'getItemsByType', (data, postData) => {
    console.log('InventoryService.getItemsByType');
    console.log(data.responseData);
    InventoryTracker.inventory.set(data.responseData);
});

// rewards from quests, FPs are added to a GB, FPs used for research
FoEproxy.addHandler('InventoryService', 'getItemAmount', (data, postData) => {
    console.log('InventoryService.getItemAmount');
    console.log(data.responseData);
    InventoryTracker.inventory.update(data.responseData);
});

// when a great building where the player hag invested has been levelled
FoEproxy.addHandler('BlueprintService','newReward', (data, postData) => {
    // console.log('BlueprintService.newReward');
    // InventoryTracker.fp.addAfterLeveling( data );
});

FoEproxy.addHandler('NoticeIndicatorService', 'removePlayerItemNoticeIndicators', (data, postData) => {
    console.log('NoticeIndicatorService.removePlayerItemNoticeIndicators');
    console.log(data.responseData);
    InventoryTracker.inventory.resetNew();
});

// debug
FoEproxy.addRawWsHandler( data => {
    if ( !data || !data[0] ){ return; }
    let requestClass = data[0].requestClass;
    let requestMethod = data[0].requestMethod;
    if ( requestClass == 'NoticeIndicatorService' && requestMethod == 'getPlayerNoticeIndicators' ){
        console.log( `NoticeIndicatorService.getPlayerNoticeIndicators` );
        console.log( data[0].responseData );
        if ( data[0].responseData ) {
            InventoryTracker.inventory.updateRewards( data[0].responseData );
        }
    }
    // else {
    //     console.log( `NoticeIndicatorService.${requestMethod}` );
    //     console.log( data[0].responseData );
    // }
});