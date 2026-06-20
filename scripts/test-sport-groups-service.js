const sportGroupsService = require('../src/services/sport-groups.service');

async function testService() {
    try {
        console.log('🔍 Test du service sportGroupsService.getGroups...\n');
        
        const result = await sportGroupsService.getGroups({ 
            phone: '+242069735418', 
            city: 'brazzaville' 
        });
        
        console.log('📋 RÉSULTAT DU SERVICE :');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testService();
