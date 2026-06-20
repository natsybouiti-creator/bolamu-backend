try {
    console.log('🔍 Test import sport-groups.service...');
    const sportGroupsService = require('../src/services/sport-groups.service');
    console.log('✅ Import réussi');
    console.log('Exported functions:', Object.keys(sportGroupsService));
} catch (error) {
    console.error('❌ Erreur import:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
