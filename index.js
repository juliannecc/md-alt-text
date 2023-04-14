const core = require('@actions/core');
const github = require('@actions/github');

(
    async () => {
        try {
            core.notice('hi')

        } catch (error) {
            core.setFailed(error.message);
        }
    }

)();