/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Load styles for the remaining onboarding variant.
import './media/variationA.css';

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import product from '../../../../platform/product/common/product.js';
import { IOnboardingService } from '../common/onboardingService.js';
import { OnboardingVariationA } from './onboardingVariationA.js';

/**
 * Qortex (QAM-511): the upstream onboarding wizard is a default-chat-agent
 * (GitHub Copilot) sign-in funnel. When no default chat agent is configured in
 * product.json, register a no-op onboarding service instead. Qortex's own
 * first-run onboarding is tracked separately (QAM-508).
 */
class NoOpOnboardingService extends Disposable implements IOnboardingService {
	declare readonly _serviceBrand: undefined;
	private readonly _onDidDismiss = this._register(new Emitter<void>());
	readonly onDidDismiss: Event<void> = this._onDidDismiss.event;
	show(): void {
		// no-op: no default chat agent is bundled
	}
}

if (product.defaultChatAgent) {
	registerSingleton(IOnboardingService, OnboardingVariationA, InstantiationType.Delayed);
} else {
	registerSingleton(IOnboardingService, NoOpOnboardingService, InstantiationType.Delayed);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.welcomeOnboarding2026',
			title: localize2('welcomeOnboarding2026', "Welcome Onboarding 2026"),
			category: Categories.Developer,
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.show();
	}
});
