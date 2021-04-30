const express=require('express');
const app=express();
const MongoClient=require('mongodb');
const bodyparser=require('body-parser');
const excel = require('exceljs');
var db;

MongoClient.connect('mongodb://localhost:27017/Book_Inventory',(err,database)=>{
	if(err) return console.log(err);
	db=database.db('Book_Inventory');
	app.listen(3000,()=>{
		console.log("Running on port 3000");
	})
})

app.set('view engine','ejs');
app.use(bodyparser.urlencoded({extended : true}));
app.use(bodyparser.json());
app.use(express.static('public'))

app.get('/',(req,res)=>{
	db.collection('Books').find().toArray((err,result)=>{
		if(err) return console.log(err);
		res.render('Home.ejs',{data:result});
	})
})


app.get('/create',(req,res)=>{
	res.render("add.ejs");
})
app.get('/home',(req,res)=>{
	res.redirect("/");
})

app.get('/edit',(req,res)=>{
	var BookId=req.query.BookId;
	db.collection('Books').find().toArray((err,result)=>{
		if(err) return console.log(err);
		res.render('edit.ejs',{data:{BookId:BookId,Books:result}});
	})
})

app.post('/Add',(req,res)=>{
	db.collection('Books').save(req.body,(err,result)=>{
		if(err) return console.log(err);
		res.redirect('/');
	})
})

app.post('/delete',(req,res)=>{
	var id=req.body.BookId;
	var query={BookId:id}
	db.collection('Books').deleteOne(query,(err,result)=>{
		if(err) return console.log(err);
		res.redirect('/');
	})
})

app.post('/editupdate',(req,res)=>{
	var oldQuantity;
	var DATE=new Date();
	let day = ("0" + DATE.getDate()).slice(-2);
	let month = ("0" + (DATE.getMonth() + 1)).slice(-2);
	let year = DATE.getFullYear();
	var date=day.toString()+"-"+month.toString()+"-"+year.toString();
	var price;
	var quantity;
	var t_price;
	var change;
	var set=0;
	var id={BookId:req.body.BookId};
	var newValue;
	db.collection('Books').find().toArray((err,result)=>{
		for(var i=0;i<result.length;i++){
			if(result[i].BookId==req.body.BookId){
				oldQuantity=result[i].Quantity;
				if(parseInt(req.body.Quantity)+parseInt(oldQuantity)<parseInt(oldQuantity)){
					price=result[i].Price;
					quantity=parseInt(req.body.Quantity)*-1;
					t_price=(parseInt(req.body.Quantity))*parseInt(req.body.Price)*-1;
				}
				break;
			}
		}
		if(parseInt(req.body.Quantity)+parseInt(oldQuantity)<0){
			set=1;
			change=(parseInt(req.body.Quantity)+parseInt(oldQuantity))*-1;
			newValue={ $set :{Quantity:0,Price:req.body.Price}};
			quantity=quantity-change;
		}
		else{newValue={ $set :{Quantity:parseInt(req.body.Quantity)+parseInt(oldQuantity),Price:req.body.Price}};}
		db.collection('Books').updateOne(id,newValue,(err,result)=>{
			if(err) return console.log(err);
			if(parseInt(req.body.Quantity)+parseInt(oldQuantity)<parseInt(oldQuantity)){
				db.collection('BooksSales').find({BookId:req.body.BookId}).toArray((err,da)=>{
					var flag=0;
					for(var k=0;k<da.length;k++){
					if(da[k].Purchase_Date==date){
						flag=1;
						console.log("inside");
						var total=(da[k].Total_Price+t_price);
						var quan=da[k].Quantity+quantity;
						var updatequery={ $set :{Quantity:quan,Total_Price:total}};
						var _id={_id:da[k]._id};
						db.collection('BooksSales').updateOne(_id,updatequery,(err, bookresult)=>{
							if(err) return console.log("err");
						})
					}}
					if(flag==0){
						console.log("today");
						var q={Purchase_Date:date,BookId:req.body.BookId,Price:price,Quantity:(quantity),Total_Price:t_price}
						db.collection('BooksSales').insertOne(q,(err,resultsale)=>{
							if(err) return console.log(err);
						})
					}
				})
			}
			res.redirect('/');
		})
	})
})


app.get('/sales',(req,res)=>{
	db.collection('BooksSales').find().toArray((err,result)=>{
		if(err) return console.log("err");
		res.render('SalesDetails.ejs',{data:result});
	})
	
})

app.get('/updatesale',(req,res)=>{
	res.render("updatesales.ejs");
})


app.post('/salesUpdate',(req,res)=>{
	db.collection('BooksSales').find({BookId:req.body.BookId,Purchase_Date:req.body.Purchase_Date}).toArray((err,result)=>{
		if(result.length==0){
			console.log("Couldn't found id or date");
		}
		else{
		if(err) return console.log(err);
		var t_price=parseInt(result[0].Total_Price)-(parseInt(req.body.Quantity)*parseInt(result[0].Price)*-1);
		var quantity=parseInt(result[0].Quantity)+parseInt(req.body.Quantity);
		var query1={ $set :{Quantity:quantity,Total_Price:t_price}}
		var query={ _id :result[0]._id}
		var id=req.body.BookId;
		var qq=parseInt(req.body.Quantity)*-1;
		if(quantity<=0){
			if(quantity<0){
				qq=result[0].Quantity;
			}
			db.collection('BooksSales').deleteOne(query,(err,resultdel)=>{
				if(err) return console.log(err);
			})
		}
		else{
		db.collection('BooksSales').updateOne(query,query1,(err,results)=>{
			if(err) return console.log(err);
		})}
		db.collection('Books').find({BookId:req.body.BookId}).toArray((err,resultsss)=>{
			if(err) return console.log(err);
			var q=(qq)+resultsss[0].Quantity;
			var qr={ $set :{Quantity:q}}
			db.collection("Books").updateOne({BookId:req.body.BookId},qr,(err,resultss)=>{
				if(err) return console.log(err);
			})
		})
		}
		res.redirect('/sales')
		
	})
})

app.post('/excel',(req,res)=>{
	db.collection('BooksSales').find().toArray((err,result)=>{
		if(err) return console.log(err);
		let workbook = new excel.Workbook(); 
		let worksheet = workbook.addWorksheet('BooksSales');
		worksheet.columns = [
			{header:'Purchase_Date',key:'Purchase_Date',width:20 },
			{ header: 'BookId', key: 'BookId', width: 10 },
			{ header: 'Price', key: 'Price', width: 10 },
			{ header: 'Quantity', key: 'Quantity', width: 10 },
			{ header: 'Total Price', key: 'Total_Price', width: 10, outlineLevel: 1}
		];
		worksheet.addRows(result);
		workbook.xlsx.writeFile("sales.xlsx").then(function() {
			console.log("file saved!");
		});
		res.redirect('/sales');
	})
})
