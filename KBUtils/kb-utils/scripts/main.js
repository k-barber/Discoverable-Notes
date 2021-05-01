var Character_Containers = {};

Hooks.on("preCreateOwnedItem", async function (Recipient, Char_Item, other_data, UserID) {
    var original_items = duplicate(Recipient.data.items);

    if (Recipient && Char_Item && other_data && UserID) {
        var user = await game.users.get(UserID);
        var container = await game.actors.get(Recipient.data._id);
        if ((!(user.isGM)) && Object.keys(Character_Containers).includes(Recipient.data._id)) {
            Char_Item._id;
            var user = await game.users.get(UserID);
            var character = await game.actors.get(user.actorId);
            let item = character.items.find(i => i._id === Char_Item._id);
            if (item) {
                if (item.data.data.quantity > 1) {
                    await item.update({
                        data: {
                            quantity: item.data.data.quantity - 1
                        }
                    });
                } else {
                    await character.deleteOwnedItem(Char_Item._id);
                }

                ChatMessage.create({
                    speaker: {
                        actor: Recipient.data._id
                    },
                    content: character.name + " put " + Char_Item.name + " into " + Recipient.data.name
                });

            } else {
                ChatMessage.create({
                    speaker: {
                        actor: Recipient.data._id
                    },
                    content: character.name + " put " + Char_Item.name + " into " + Recipient.data.name + " from an unknown source."
                });
            }

            var original = null;
            for (let i = 0; i < original_items.length; i++) {
                if (original_items[i].name === Char_Item.name) {
                    original = original_items[i];
                    break;
                }
            }
            var existing;
            if (original) {
                existing = container.items.find(e => (e.data.name === Char_Item.name) && (e._id !== original._id));
            } else {
                existing = container.items.find(e => (e.data.name === Char_Item.name));
            }
            if (existing) {
                if (original) {
                    var updated = container.items.find(e => e._id === original._id);
                    updated.update({
                        data: {
                            quantity: original.data.quantity + 1
                        }
                    })
                    await container.deleteOwnedItem(existing._id);
                } else {
                    existing.update({
                        data: {
                            quantity: 1
                        }
                    })
                }
            }
        }

    }

})

Hooks.on("updateActor", async function (ActorData, UpdateData, Diff, UserID) {

    if (ActorData && UpdateData && Diff && UserID) {
        var user = await game.users.get(UserID);
        if ((!(user.isGM)) && Object.keys(Character_Containers).includes(UpdateData._id)) {

            // NPC currency {gp: {value: 23}, sp: {value : 23}}
            // PC currency {gp: 23, sp: 23}
            let original_container_values = duplicate(Character_Containers[UpdateData._id]);
            console.log(original_container_values)
            let new_container_values = UpdateData.data.currency;
            console.log(new_container_values)
            var differences = {};
            var increasing = false;
            let denomination = ""
            let keys = Object.keys(new_container_values);
            for (let i = 0; i < keys.length; i++) {
                denomination = keys[i];
                if (new_container_values[denomination].value > original_container_values[denomination].value) {
                    increasing = true;
                    differences[denomination] = new_container_values[denomination].value - original_container_values[denomination].value;
                }
            }

            if (increasing) {
                var character = await game.actors.get(user.actorId);
                var container = await game.actors.get(UpdateData._id);
                var original_character_values = duplicate(character.data.data.currency);
                var new_character_values = {};
                var enough = true
                denomination = ""
                keys = Object.keys(differences);
                for (let i = 0; i < keys.length; i++) {
                    denomination = keys[i];
                    if (differences[denomination] > original_character_values[denomination]) {
                        enough = false;
                        break;
                    }
                    new_character_values[denomination] = (original_character_values[denomination] - differences[denomination]);
                }

                if (!(enough)) {
                    ui.notifications.error("You don't have that much money...");
                    await container.update({
                        data: {
                            currency: original_container_values
                        }
                    });
                    return;
                }

                await character.update({
                    data: {
                        currency: new_character_values
                    }
                });

                var input = ""
                for (const [denomination, value] of Object.entries(differences)) {


                    input += denomination + " x " + value + ",";
                }
                input.slice(0, -1);

                ChatMessage.create({
                    speaker: {
                        actor: character._id
                    },
                    content: character.name + " put " + input + " into " + container.name
                });

            }

            denomination = ""
            keys = Object.keys(new_container_values);

            for (let i = 0; i < keys.length; i++) {
                denomination = keys[i];
                Character_Containers[UpdateData._id][denomination] = duplicate(new_container_values[denomination]);
            }
            console.log(Character_Containers)

        }
    }


});

Hooks.once('renderApplication', async function () {
    var containers_folder = game.folders.find(e => e.data.name === "Character Containers");
    if (!(containers_folder)) {
        await Folder.create({
            name: "Character Containers",
            parent: null,
            type: "Actor",
            depth: 1
        });
        containers_folder = game.folders.find(e => e.data.name === "Character Containers");
    }
    for (let i = 0; i < containers_folder.content.length; i++) {
        Character_Containers[containers_folder.content[i].data._id] = duplicate(containers_folder.content[i].data.data.currency);
    }

});